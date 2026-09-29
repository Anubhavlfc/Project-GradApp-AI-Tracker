import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from './support/db';

// supabase/verify-setup.sql is what a person runs against their real Supabase project. These
// tests prove each check passes on a correct database and fails when the thing it guards breaks.

const script = readFileSync(fileURLToPath(new URL('../verify-setup.sql', import.meta.url)), 'utf8');

let db: PGlite;
beforeAll(async () => {
  db = await createDatabase();
});
afterAll(async () => {
  await db.close();
});

type Row = { check_name: string; passed: boolean };

/** Breaks something inside a transaction, runs the script, and rolls the change back. */
async function withBreakage(breakage: string): Promise<Row[]> {
  let rows: Row[] = [];
  await db.transaction(async (tx: Transaction) => {
    await tx.exec(breakage);
    rows = (await tx.query<Row>(script)).rows;
    await tx.rollback();
  });
  return rows;
}

const failing = (rows: Row[]) => rows.filter((row) => !row.passed).map((row) => row.check_name);

describe('verify-setup.sql', () => {
  it('passes every check on a correctly migrated database', async () => {
    const rows = (await db.query<Row>(script)).rows;
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(failing(rows)).toEqual([]);
  });

  it.each([
    [
      'a table without row level security',
      'alter table public.tasks disable row level security',
      /Row level security/,
    ],
    [
      'a table without policies',
      'drop policy "Users manage their own tasks" on public.tasks',
      /at least one policy/,
    ],
    ['anon access to a table', 'grant select on public.tasks to anon', /anon/],
    ['anon access to a single column', 'grant select (title) on public.tasks to anon', /anon/],
    [
      'truncate rights for signed-in users',
      'grant truncate on public.tasks to authenticated',
      /truncate/,
    ],
    [
      'a callable function',
      'grant execute on function public.set_updated_at() to authenticated',
      /only delete_my_account/,
    ],
    [
      'a function callable by anon',
      'grant execute on function public.set_updated_at() to anon',
      /Signed-out visitors \(anon\) cannot call functions/,
    ],
    [
      'account deletion open to signed-out visitors',
      'grant execute on function public.delete_my_account() to anon',
      /Signed-out visitors \(anon\) cannot call functions/,
    ],
    [
      'account deletion that signed-in people cannot reach',
      'revoke execute on function public.delete_my_account() from authenticated',
      /only delete_my_account/,
    ],
    [
      'account deletion that is missing',
      'drop function public.delete_my_account()',
      /only delete_my_account/,
    ],
    [
      'a view that ignores the caller',
      'create view public.leaky as select * from public.tasks',
      /view/,
    ],
    ['a missing profile trigger', 'drop trigger on_auth_user_created on auth.users', /profile/],
  ])('fails for %s', async (_name, breakage, expected) => {
    const failures = failing(await withBreakage(breakage));
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(expected);
  });

  it("accepts a view that runs with the caller's permissions", async () => {
    const rows = await withBreakage(
      'create view public.mine with (security_invoker = true) as select id from public.tasks',
    );
    expect(failing(rows)).toEqual([]);
  });
});
