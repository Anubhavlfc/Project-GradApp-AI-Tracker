import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDemoData, dayOffset, isDemoEmail, SAMPLE_NOTE } from '../../scripts/demo-data.mjs';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The sample data is written by scripts/seed-demo.mjs, which cannot be tried against a hosted
// project in a test. What can be checked is that every row it would send is accepted by the real
// migrations (types, checks, foreign keys, row level security) and is labelled as a sample.

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, name] of [
    [USER_A, 'demo'],
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

const TABLES = [
  'universities',
  'applications',
  'documents',
  'requirements',
  'recommenders',
  'recommendation_requests',
  'funding',
  'tasks',
] as const;

// A fixed day, so the test does not depend on when it runs.
const TODAY = new Date(2026, 8, 29);
const demo = () => {
  let next = 0;
  return buildDemoData(TODAY, () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`);
};

describe('sample data', () => {
  it('is accepted by the real schema, in the order the script writes it', async () => {
    const data = demo();
    const counts = await asCaller(db, { role: 'authenticated', userId: USER_A }, async (tx) => {
      for (const table of TABLES) {
        for (const row of data[table] as Record<string, unknown>[]) {
          // Insert only the fields the script sends; the database supplies everything else.
          const columns = Object.keys(row);
          await tx.query(
            `insert into public.${table} (${columns.join(', ')}) values (${columns
              .map((_, index) => `$${index + 1}`)
              .join(', ')})`,
            columns.map((column) => row[column]),
          );
        }
      }
      const counted: Record<string, number> = {};
      for (const table of TABLES) {
        const result = await tx.query<{ n: number }>(
          `select count(*)::int as n from public.${table}`,
        );
        counted[table] = result.rows[0]!.n;
      }
      return counted;
    });
    expect(counts).toEqual({
      universities: 5,
      applications: 5,
      documents: 3,
      requirements: 15,
      recommenders: 3,
      recommendation_requests: 6,
      funding: 4,
      tasks: 6,
    });
  });

  it('belongs to whoever it is written for, and to nobody else', async () => {
    const data = demo();
    const visible = await asCaller(db, { role: 'authenticated', userId: USER_A }, async (tx) => {
      for (const table of TABLES) {
        for (const row of data[table] as Record<string, unknown>[]) {
          const columns = Object.keys(row);
          await tx.query(
            `insert into public.${table} (${columns.join(', ')}) values (${columns
              .map((_, index) => `$${index + 1}`)
              .join(', ')})`,
            columns.map((column) => row[column]),
          );
        }
      }
      // The same connection, now as someone else.
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [USER_B]);
      const seenByB = await tx.query<{ n: number }>(
        'select count(*)::int as n from public.applications',
      );
      return seenByB.rows[0]!.n;
    });
    expect(visible).toBe(0);
  });

  it('says it is a sample in every row that has notes', () => {
    const data = demo();
    for (const table of TABLES) {
      for (const row of data[table] as { notes?: string }[]) {
        if ('notes' in row) expect(row.notes, table).toBe(SAMPLE_NOTE);
      }
    }
    // The programs, the people and the money are where a reader would look first.
    for (const table of [
      'applications',
      'recommenders',
      'funding',
      'documents',
      'tasks',
    ] as const) {
      expect(
        (data[table] as { notes?: string }[]).every((row) => row.notes === SAMPLE_NOTE),
        table,
      ).toBe(true);
    }
  });

  it('has the five programs the product was planned around, and only those', () => {
    const data = demo();
    const names = new Map(
      data.universities.map((u: { id: string; name: string }) => [u.id, u.name]),
    );
    const programs = data.applications
      .map(
        (a: { university_id: string; program_name: string }) =>
          `${names.get(a.university_id)}: ${a.program_name}`,
      )
      .sort();
    expect(programs).toEqual([
      'Carnegie Mellon University: Computational Finance',
      'Columbia University: Applied Analytics',
      'Stanford University: Computer Science',
      'UC Berkeley: Master of Analytics',
      'University of Washington: Data Science',
    ]);
  });

  it('spreads programs over the stages, and dates around today, so every card has something to show', () => {
    const data = demo();
    expect(new Set(data.applications.map((a: { status: string }) => a.status))).toEqual(
      new Set([
        'documents_in_progress',
        'application_started',
        'shortlisted',
        'submitted',
        'researching',
      ]),
    );
    const open = data.tasks.filter((task: { status: string }) => task.status !== 'complete');
    const late = open.filter((task: { due_date: string }) => task.due_date < dayOffset(TODAY, 0));
    const thisWeek = open.filter(
      (task: { due_date: string }) =>
        task.due_date >= dayOffset(TODAY, 0) && task.due_date <= dayOffset(TODAY, 7),
    );
    expect(late).toHaveLength(1);
    expect(thisWeek.length).toBeGreaterThanOrEqual(2);
  });

  it('is dated from the day it is made, so it never goes stale', () => {
    const later = buildDemoData(new Date(2027, 0, 15));
    expect(
      later.applications.find(
        (a: { program_name: string }) => a.program_name === 'Computer Science',
      )?.deadline,
    ).toBe('2027-02-05');
  });
});

describe('dayOffset', () => {
  it('counts calendar days, across month ends and the leap day', () => {
    expect(dayOffset(new Date(2026, 0, 31), 1)).toBe('2026-02-01');
    expect(dayOffset(new Date(2028, 1, 28), 1)).toBe('2028-02-29');
    expect(dayOffset(new Date(2026, 2, 1), -1)).toBe('2026-02-28');
  });
});

describe('isDemoEmail', () => {
  it.each([
    'demo@example.com',
    'Demo@Example.com',
    'demo+portfolio@example.com',
    'demo.2026@example.com',
    ' demo@example.com ',
  ])('accepts %s', (email) => expect(isDemoEmail(email)).toBe(true));
  it.each([
    'anuv@example.com',
    'demonstrator@example.com',
    'my.demo@example.com',
    'undemo@example.com',
    '',
  ])('refuses %s', (email) => expect(isDemoEmail(email)).toBe(false));
});
