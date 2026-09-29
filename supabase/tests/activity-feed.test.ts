import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asCaller, createDatabase, seedUser, USER_A, USER_B, type Caller } from './support/db';

// "Recent activity" on the dashboard is written by database triggers, so the only honest test is
// against the real migrations: does each change leave the right entry, and does nothing else?

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, name] of [
    [USER_A, 'ada'],
    [USER_B, 'bob'],
  ]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [
      id,
      `${name}@example.com`,
    ]);
  }
});

afterAll(async () => {
  await db.close();
});

const asA = { role: 'authenticated', userId: USER_A } as const;
const asB = { role: 'authenticated', userId: USER_B } as const;

const PROGRAM = 'Stanford University - MS Computer Science';

/** A program of the signed-in person's; returns its id. */
async function newProgram(tx: Transaction): Promise<string> {
  const university = await tx.query<{ id: string }>(
    "insert into public.universities (name) values ('Stanford University') returning id",
  );
  const application = await tx.query<{ id: string }>(
    "insert into public.applications (university_id, program_name) values ($1, 'MS Computer Science') returning id",
    [university.rows[0]!.id],
  );
  return application.rows[0]!.id;
}

async function insertId(tx: Transaction, sql: string, params: unknown[] = []): Promise<string> {
  const result = await tx.query<{ id: string }>(sql, params);
  return result.rows[0]!.id;
}

type Entry = {
  subject: string;
  detail: string | null;
  meta: Record<string, unknown>;
  application_id: string | null;
};

/** The signed-in person's entries of one kind, in a steady order. */
async function entries(tx: Transaction, kind: string): Promise<Entry[]> {
  const result = await tx.query<Entry>(
    'select subject, detail, meta, application_id from public.activity where kind = $1 order by subject, detail',
    [kind],
  );
  return result.rows;
}

describe('checklist items', () => {
  it('log every change of status, and nothing else', async () => {
    const { first, second, third } = await asCaller(db, asA, async (tx) => {
      const program = await newProgram(tx);
      const transcript = await insertId(
        tx,
        "insert into public.requirements (application_id, kind) values ($1, 'transcript') returning id",
        [program],
      );
      const letter = await insertId(
        tx,
        "insert into public.requirements (application_id, kind, label) values ($1, 'recommendation_letter', 'Recommendation Letter 2') returning id",
        [program],
      );
      // Adding an item is not an event.
      const first = await entries(tx, 'requirement_updated');

      await tx.query("update public.requirements set status = 'complete' where id = $1", [
        transcript,
      ]);
      await tx.query("update public.requirements set status = 'in_progress' where id = $1", [
        letter,
      ]);
      const second = await entries(tx, 'requirement_updated');

      // Editing other fields, or saving the same status again, is not an event either.
      await tx.query("update public.requirements set notes = 'sent by post' where id = $1", [
        transcript,
      ]);
      await tx.query("update public.requirements set status = 'complete' where id = $1", [
        transcript,
      ]);
      await tx.query('update public.requirements set is_required = false where id = $1', [letter]);
      const third = await entries(tx, 'requirement_updated');
      return { first, second, third };
    });

    expect(first).toEqual([]);
    expect(second).toEqual([
      expect.objectContaining({
        subject: PROGRAM,
        detail: 'complete',
        meta: { requirement: 'transcript', label: null },
      }),
      expect.objectContaining({
        subject: PROGRAM,
        detail: 'in_progress',
        meta: { requirement: 'recommendation_letter', label: 'Recommendation Letter 2' },
      }),
    ]);
    expect(third).toEqual(second);
  });

  it('are logged against the program they belong to', async () => {
    const { program, logged } = await asCaller(db, asA, async (tx) => {
      const program = await newProgram(tx);
      const item = await insertId(
        tx,
        "insert into public.requirements (application_id, kind) values ($1, 'gre') returning id",
        [program],
      );
      await tx.query("update public.requirements set status = 'submitted' where id = $1", [item]);
      return { program, logged: await entries(tx, 'requirement_updated') };
    });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ application_id: program, detail: 'submitted' });
  });

  it('are not logged when a deleted document clears their link', async () => {
    const logged = await asCaller(db, asA, async (tx) => {
      const program = await newProgram(tx);
      const document = await insertId(
        tx,
        "insert into public.documents (name, kind) values ('Transcript', 'transcript') returning id",
      );
      await tx.query(
        "insert into public.requirements (application_id, kind, document_id) values ($1, 'transcript', $2)",
        [program, document],
      );
      await tx.query('delete from public.documents where id = $1', [document]);
      return tx.query('select 1 from public.activity where kind <> $1', ['application_added']);
    });
    expect(logged.rows).toEqual([]);
  });
});

describe('recommendation letters', () => {
  it('log the person writing the letter and the new status, and only when the status changes', async () => {
    const { before, after, later } = await asCaller(db, asA, async (tx) => {
      const program = await newProgram(tx);
      const person = await insertId(
        tx,
        "insert into public.recommenders (name) values ('Dr. Grace Hopper') returning id",
      );
      const request = await insertId(
        tx,
        'insert into public.recommendation_requests (recommender_id, application_id) values ($1, $2) returning id',
        [person, program],
      );
      const before = await entries(tx, 'letter_updated');
      await tx.query(
        "update public.recommendation_requests set status = 'requested', requested_on = current_date where id = $1",
        [request],
      );
      const after = await entries(tx, 'letter_updated');
      await tx.query("update public.recommendation_requests set notes = 'call her' where id = $1", [
        request,
      ]);
      await tx.query(
        "update public.recommendation_requests set status = 'requested' where id = $1",
        [request],
      );
      return { before, after, later: await entries(tx, 'letter_updated') };
    });
    expect(before).toEqual([]);
    expect(after).toEqual([
      expect.objectContaining({
        subject: PROGRAM,
        detail: 'requested',
        meta: { recommender: 'Dr. Grace Hopper' },
      }),
    ]);
    expect(later).toEqual(after);
  });
});

describe('funding', () => {
  it('logs a change of status by name, with the program when there is one', async () => {
    const logged = await asCaller(db, asA, async (tx) => {
      const program = await newProgram(tx);
      const tied = await insertId(
        tx,
        "insert into public.funding (application_id, name, kind) values ($1, 'Departmental fellowship', 'fellowship') returning id",
        [program],
      );
      const outside = await insertId(
        tx,
        "insert into public.funding (name, kind) values ('Rotary scholarship', 'external_scholarship') returning id",
      );
      await tx.query("update public.funding set status = 'offered' where id = $1", [tied]);
      await tx.query("update public.funding set status = 'applied' where id = $1", [outside]);
      // Not a change of status:
      await tx.query('update public.funding set amount = 5000 where id = $1', [tied]);
      return entries(tx, 'funding_updated');
    });
    expect(logged).toEqual([
      expect.objectContaining({
        subject: 'Departmental fellowship',
        detail: 'offered',
        meta: { program: PROGRAM },
      }),
      expect.objectContaining({
        subject: 'Rotary scholarship',
        detail: 'applied',
        meta: { program: null },
        application_id: null,
      }),
    ]);
  });
});

describe('tasks', () => {
  it('log when they are finished, each time, and never when they are reopened or edited', async () => {
    const { afterAdd, afterFirst, afterEdits, afterSecond } = await asCaller(
      db,
      asA,
      async (tx) => {
        const program = await newProgram(tx);
        const task = await insertId(
          tx,
          "insert into public.tasks (application_id, title) values ($1, 'Email Prof. Lee') returning id",
          [program],
        );
        const afterAdd = await entries(tx, 'task_completed');
        await tx.query("update public.tasks set status = 'complete' where id = $1", [task]);
        const afterFirst = await entries(tx, 'task_completed');
        await tx.query("update public.tasks set priority = 'high' where id = $1", [task]);
        await tx.query("update public.tasks set status = 'in_progress' where id = $1", [task]);
        const afterEdits = await entries(tx, 'task_completed');
        await tx.query("update public.tasks set status = 'complete' where id = $1", [task]);
        return {
          afterAdd,
          afterFirst,
          afterEdits,
          afterSecond: await entries(tx, 'task_completed'),
        };
      },
    );
    expect(afterAdd).toEqual([]);
    expect(afterFirst).toEqual([
      expect.objectContaining({
        subject: 'Email Prof. Lee',
        detail: null,
        meta: { program: PROGRAM },
      }),
    ]);
    expect(afterEdits).toEqual(afterFirst);
    expect(afterSecond).toHaveLength(2);
  });

  it('log without a program when the task has none', async () => {
    const logged = await asCaller(db, asA, async (tx) => {
      const task = await insertId(
        tx,
        "insert into public.tasks (title) values ('Renew passport') returning id",
      );
      await tx.query("update public.tasks set status = 'complete' where id = $1", [task]);
      return entries(tx, 'task_completed');
    });
    expect(logged).toEqual([
      expect.objectContaining({
        subject: 'Renew passport',
        meta: { program: null },
        application_id: null,
      }),
    ]);
  });

  it('are not logged when they are added already finished', async () => {
    const logged = await asCaller(db, asA, async (tx) => {
      await tx.query(
        "insert into public.tasks (title, status) values ('Done already', 'complete')",
      );
      return entries(tx, 'task_completed');
    });
    expect(logged).toEqual([]);
  });
});

describe('documents', () => {
  it('log when they are finished, by name and type, and not before', async () => {
    const { started, finished } = await asCaller(db, asA, async (tx) => {
      const document = await insertId(
        tx,
        "insert into public.documents (name, kind) values ('Resume, 2026', 'resume') returning id",
      );
      await tx.query("update public.documents set status = 'in_progress' where id = $1", [
        document,
      ]);
      const started = await entries(tx, 'document_completed');
      await tx.query("update public.documents set status = 'complete' where id = $1", [document]);
      return { started, finished: await entries(tx, 'document_completed') };
    });
    expect(started).toEqual([]);
    expect(finished).toEqual([
      expect.objectContaining({
        subject: 'Resume, 2026',
        meta: { document: 'resume' },
        application_id: null,
      }),
    ]);
  });
});

describe('privacy and integrity', () => {
  it("keeps one person's entries out of another person's view", async () => {
    // Committed as the database owner, so other people can look afterwards.
    const carol = await seedUser(db, '33333333-3333-4333-8333-333333333333', 'Carol');
    await db.query("update public.requirements set status = 'complete' where user_id = $1", [
      carol.userId,
    ]);
    await db.query("update public.tasks set status = 'complete' where user_id = $1", [
      carol.userId,
    ]);

    const kindsSeenBy = (caller: Caller) =>
      asCaller(db, caller, async (tx) => {
        const result = await tx.query<{ kind: string }>(
          'select kind from public.activity order by kind',
        );
        return result.rows.map((row) => row.kind);
      });
    expect(await kindsSeenBy({ role: 'authenticated', userId: carol.userId })).toEqual(
      expect.arrayContaining(['requirement_updated', 'task_completed']),
    );
    expect(await kindsSeenBy(asA)).toEqual([]);
    expect(await kindsSeenBy(asB)).toEqual([]);
    // Someone who is not signed in is not even allowed to look.
    await expect(kindsSeenBy({ role: 'anon' })).rejects.toMatchObject({ code: '42501' });
  });

  it('keeps entries, without the program link, when a program is deleted', async () => {
    const { program, kept } = await asCaller(db, asA, async (tx) => {
      const program = await newProgram(tx);
      const item = await insertId(
        tx,
        "insert into public.requirements (application_id, kind) values ($1, 'transcript') returning id",
        [program],
      );
      await tx.query("update public.requirements set status = 'complete' where id = $1", [item]);
      await tx.query('delete from public.applications where id = $1', [program]);
      await tx.exec('set constraints all immediate');
      return { program, kept: await entries(tx, 'requirement_updated') };
    });
    expect(program).toBeTruthy();
    expect(kept).toEqual([
      expect.objectContaining({ subject: PROGRAM, detail: 'complete', application_id: null }),
    ]);
  });

  it('lets a whole account be deleted, entries and all', async () => {
    const graph = await seedUser(db, '44444444-4444-4444-8444-444444444444', 'Dana');
    await db.query("update public.requirements set status = 'complete' where user_id = $1", [
      graph.userId,
    ]);
    await db.query("update public.funding set status = 'accepted' where user_id = $1", [
      graph.userId,
    ]);
    await db.query('delete from auth.users where id = $1', [graph.userId]);
    const left = await db.query<{ n: string }>(
      'select count(*) as n from public.activity where user_id = $1',
      [graph.userId],
    );
    expect(Number(left.rows[0]?.n)).toBe(0);
  });

  it('refuses entries of an unknown kind, or with meta that is not an object', async () => {
    const insertEntry = (client: Pick<PGlite, 'query'>, kind: string, meta: string) =>
      client.query(
        'insert into public.activity (user_id, kind, subject, meta) values ($1, $2, $3, $4::jsonb)',
        [USER_A, kind, 'x', meta],
      );
    await expect(insertEntry(db, 'made_up', '{}')).rejects.toMatchObject({ code: '23514' });
    await expect(insertEntry(db, 'task_completed', '[1]')).rejects.toMatchObject({
      code: '23514',
    });
    await expect(insertEntry(db, 'task_completed', '"text"')).rejects.toMatchObject({
      code: '23514',
    });
    await expect(
      insertEntry(db, 'task_completed', JSON.stringify({ note: 'x'.repeat(2001) })),
    ).rejects.toMatchObject({ code: '23514' });
    // The same insert with good values works (and is rolled back, so it is not left behind).
    await db.transaction(async (tx) => {
      await insertEntry(tx, 'task_completed', '{}');
      await tx.rollback();
    });
  });

  it("cannot be used to look up someone else's program names", async () => {
    const graph = await seedUser(db, '55555555-5555-4555-8555-555555555555', 'Erin');
    await expect(
      asCaller(db, asB, (tx) =>
        tx.query('select public.program_label($1, $2)', [graph.applications, graph.userId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
