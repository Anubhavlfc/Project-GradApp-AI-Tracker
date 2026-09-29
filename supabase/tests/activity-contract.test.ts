import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeActivity } from '../../src/features/activity/describe';
import { ACTIVITY_KINDS } from '../../src/features/activity/kinds';
import { activityRowSchema, type ActivityRow } from '../../src/features/activity/types';
import { asCaller, createDatabase, USER_A } from './support/db';

// The dashboard's "Recent activity" and the table behind it are two halves of one contract: what
// the triggers write must be readable by the screen, and worded properly. These tests run the real
// migrations and the real row schema and wording against each other.

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  await db.query('insert into auth.users (id, email) values ($1, $2)', [USER_A, 'ada@example.com']);
});

afterAll(async () => {
  await db.close();
});

const asUser = { role: 'authenticated', userId: USER_A } as const;

async function insertId(tx: Transaction, sql: string, params: unknown[] = []): Promise<string> {
  const result = await tx.query<{ id: string }>(sql, params);
  return result.rows[0]!.id;
}

/** The entries as the data API returns them: the columns the app asks for, as JSON. */
async function readEntries(tx: Transaction): Promise<ActivityRow[]> {
  const { rows } = await tx.query<{ json: string }>(
    `select to_jsonb(x)::text as json
       from (select id, application_id, kind, subject, detail, meta, created_at
               from public.activity order by kind) x`,
  );
  return rows.map((row) => activityRowSchema.parse(JSON.parse(row.json)));
}

describe('what the triggers write is what the dashboard reads', () => {
  it('reads one entry of every kind, and words each of them', async () => {
    const entries = await asCaller(db, asUser, async (tx) => {
      const university = await insertId(
        tx,
        "insert into public.universities (name) values ('Stanford University') returning id",
      );
      const program = await insertId(
        tx,
        "insert into public.applications (university_id, program_name) values ($1, 'MS Computer Science') returning id",
        [university],
      );
      const other = await insertId(
        tx,
        "insert into public.applications (university_id, program_name) values ($1, 'PhD Statistics') returning id",
        [university],
      );

      await tx.query("update public.applications set status = 'submitted' where id = $1", [
        program,
      ]);
      await tx.query('delete from public.applications where id = $1', [other]);

      const item = await insertId(
        tx,
        "insert into public.requirements (application_id, kind) values ($1, 'transcript') returning id",
        [program],
      );
      await tx.query("update public.requirements set status = 'complete' where id = $1", [item]);

      const person = await insertId(
        tx,
        "insert into public.recommenders (name) values ('Dr. Lee') returning id",
      );
      const letter = await insertId(
        tx,
        'insert into public.recommendation_requests (recommender_id, application_id) values ($1, $2) returning id',
        [person, program],
      );
      await tx.query(
        "update public.recommendation_requests set status = 'requested' where id = $1",
        [letter],
      );

      const grant = await insertId(
        tx,
        "insert into public.funding (name, kind) values ('Fulbright', 'external_scholarship') returning id",
      );
      await tx.query("update public.funding set status = 'applied' where id = $1", [grant]);

      const task = await insertId(
        tx,
        "insert into public.tasks (application_id, title) values ($1, 'Email Prof. Lee') returning id",
        [program],
      );
      await tx.query("update public.tasks set status = 'complete' where id = $1", [task]);

      const document = await insertId(
        tx,
        "insert into public.documents (name, kind) values ('Resume, 2026', 'resume') returning id",
      );
      await tx.query("update public.documents set status = 'complete' where id = $1", [document]);

      return { rows: await readEntries(tx), program };
    });

    const byKind = new Map(entries.rows.map((row) => [row.kind, row]));
    // If a migration adds a kind, this test must be taught to produce one.
    expect([...byKind.keys()].sort()).toEqual([...ACTIVITY_KINDS].sort());

    const words = (kind: string) => {
      const row = byKind.get(kind);
      if (!row) throw new Error(`no ${kind} entry`);
      return describeActivity(row);
    };
    const PROGRAM = 'Stanford University, MS Computer Science';
    const path = `/app/applications/${entries.program}`;

    // application_added is written for the first program; the log has one per program added.
    expect(words('application_added')).toMatchObject({
      headline: 'Added a program',
      context: expect.stringContaining('Stanford University, '),
    });
    expect(words('status_changed')).toEqual({
      headline: 'Status changed to Submitted',
      context: PROGRAM,
      href: path,
    });
    expect(words('application_removed')).toEqual({
      headline: 'Removed a program',
      context: 'Stanford University, PhD Statistics',
      href: null,
    });
    expect(words('requirement_updated')).toEqual({
      headline: 'Transcript marked Complete',
      context: PROGRAM,
      href: `${path}/requirements`,
    });
    expect(words('letter_updated')).toEqual({
      headline: 'Letter from Dr. Lee marked Requested',
      context: PROGRAM,
      href: `${path}/recommendations`,
    });
    expect(words('funding_updated')).toEqual({
      headline: 'Fulbright marked Applied',
      context: null,
      href: '/app/funding',
    });
    expect(words('task_completed')).toEqual({
      headline: 'Completed “Email Prof. Lee”',
      context: PROGRAM,
      href: `${path}/tasks`,
    });
    expect(words('document_completed')).toEqual({
      headline: 'Finished “Resume, 2026”',
      context: null,
      href: '/app/documents',
    });
  });

  it('allows exactly the kinds the app can word', async () => {
    const { rows } = await db.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
         from pg_constraint where conname = 'activity_kind_check'`,
    );
    const allowed = [...rows[0]!.definition.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect([...new Set(allowed)].sort()).toEqual([...ACTIVITY_KINDS].sort());
  });
});
