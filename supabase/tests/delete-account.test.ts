import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asCaller, createDatabase, seedUser, USER_A, USER_B } from './support/db';

// "Delete my account" removes a person and everything they own, and cannot be aimed at anyone
// else. The function is the only one in public that the API may call, so these tests are what
// stands between a signed-in visitor and other people's accounts.

const tables = [
  'universities',
  'applications',
  'documents',
  'requirements',
  'recommenders',
  'recommendation_requests',
  'funding',
  'tasks',
  'activity',
] as const;

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  await seedUser(db, USER_A, 'Alice');
  await seedUser(db, USER_B, 'Bob');
});

afterAll(async () => {
  await db.close();
});

const asA = { role: 'authenticated', userId: USER_A } as const;

/** What is left for one person, counted as the database owner so row level security is not in the way. */
async function whatRemains(tx: Transaction, userId: string) {
  await tx.exec('reset role');
  const left: Record<string, number> = {};
  const count = async (label: string, sql: string) => {
    const result = await tx.query<{ n: number }>(sql, [userId]);
    left[label] = result.rows[0]!.n;
  };
  await count('account', 'select count(*)::int as n from auth.users where id = $1');
  await count('profile', 'select count(*)::int as n from public.profiles where id = $1');
  for (const table of tables) {
    await count(table, `select count(*)::int as n from public.${table} where user_id = $1`);
  }
  return left;
}

describe('delete_my_account', () => {
  it('has something to delete for both people to begin with', async () => {
    // Seeding really did create rows in every table, or the tests below would prove nothing.
    for (const userId of [USER_A, USER_B]) {
      const before = await asCaller(db, asA, (tx) => whatRemains(tx, userId));
      expect(before.account).toBe(1);
      expect(before.profile).toBe(1);
      for (const table of tables) {
        if (table !== 'activity') expect(before[table], table).toBeGreaterThan(0);
      }
    }
  });

  it('deletes the caller and every row they own, including the profile and the activity log', async () => {
    const left = await asCaller(db, asA, async (tx) => {
      await tx.query('select public.delete_my_account()');
      return whatRemains(tx, USER_A);
    });
    expect(Object.values(left).every((n) => n === 0)).toBe(true);
    expect(Object.keys(left)).toEqual(['account', 'profile', ...tables]);
  });

  it("leaves everybody else's account and data exactly as it was", async () => {
    const [afterCall, untouched] = await asCaller(db, asA, async (tx) => {
      const before = await whatRemains(tx, USER_B);
      await tx.exec('set local role authenticated');
      await tx.query('select public.delete_my_account()');
      return [await whatRemains(tx, USER_B), before] as const;
    });
    expect(afterCall).toEqual(untouched);
    expect(afterCall.account).toBe(1);
  });

  it('takes no argument, so it cannot be pointed at another account', async () => {
    const result = await db.query<{ pronargs: number }>(
      "select pronargs::int from pg_proc where proname = 'delete_my_account'",
    );
    expect(result.rows).toEqual([{ pronargs: 0 }]);
    await expect(
      asCaller(db, asA, (tx) => tx.query('select public.delete_my_account($1)', [USER_B])),
    ).rejects.toThrow(/does not exist|function/i);
  });

  it('cannot be called by signed-out visitors', async () => {
    await expect(
      asCaller(db, { role: 'anon' }, (tx) => tx.query('select public.delete_my_account()')),
    ).rejects.toThrow(/permission denied/);
    // And nobody was deleted by the attempt.
    const [row] = (await db.query<{ n: number }>('select count(*)::int as n from auth.users')).rows;
    expect(row?.n).toBeGreaterThanOrEqual(1);
  });

  it('refuses a signed-in role that carries no identity, instead of deleting nobody quietly', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec('set local role authenticated');
        await tx.query('select public.delete_my_account()');
        await tx.rollback();
      }),
    ).rejects.toThrow(/Not signed in/);
  });

  it('runs with a fixed search path, so a lookalike table cannot stand in for auth.users', async () => {
    const result = await db.query<{ proconfig: string[]; prosecdef: boolean }>(
      "select proconfig, prosecdef from pg_proc where proname = 'delete_my_account'",
    );
    expect(result.rows[0]?.prosecdef).toBe(true);
    expect(result.rows[0]?.proconfig).toContain('search_path=""');
  });
});
