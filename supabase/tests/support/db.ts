import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite, type Transaction } from '@electric-sql/pglite';

const supabaseDir = fileURLToPath(new URL('../../', import.meta.url));

/** A fresh in-memory Postgres with the Supabase shim and every migration applied in order. */
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(join(supabaseDir, 'tests/support/supabase-shim.sql'), 'utf8'));
  const migrations = join(supabaseDir, 'migrations');
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(join(migrations, file), 'utf8'));
  }
  return db;
}

export type Caller = { role: 'anon' } | { role: 'authenticated'; userId: string };

/**
 * Runs `fn` the way the API would: as the `anon` or `authenticated` role with the caller's user
 * id in the JWT claims that `auth.uid()` reads. Always rolls back, so tests never affect each
 * other, and errors thrown inside `fn` propagate to the test.
 */
export async function asCaller<T>(
  db: PGlite,
  caller: Caller,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  await db.transaction(async (tx) => {
    await tx.exec(`set local role ${caller.role}`);
    if (caller.role === 'authenticated') {
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [caller.userId]);
    }
    result = await fn(tx);
    await tx.rollback();
  });
  return result as T;
}

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';

export type Graph = {
  userId: string;
  universities: string;
  applications: string;
  documents: string;
  requirements: string;
  recommenders: string;
  recommendation_requests: string;
  funding: string;
  tasks: string;
};

async function insertId(db: PGlite, sql: string, params: unknown[]): Promise<string> {
  const result = await db.query<{ id: string }>(sql, params);
  return result.rows[0]!.id;
}

/** Creates a user and one row in every user-owned table, all linked together. */
export async function seedUser(db: PGlite, userId: string, name: string): Promise<Graph> {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    userId,
    `${name.toLowerCase()}@example.com`,
    JSON.stringify({ full_name: name }),
  ]);
  const universities = await insertId(
    db,
    'insert into public.universities (user_id, name) values ($1, $2) returning id',
    [userId, `${name} University`],
  );
  const applications = await insertId(
    db,
    'insert into public.applications (user_id, university_id, program_name) values ($1, $2, $3) returning id',
    [userId, universities, `${name} MS`],
  );
  const documents = await insertId(
    db,
    "insert into public.documents (user_id, name, kind) values ($1, $2, 'resume') returning id",
    [userId, `${name} CV`],
  );
  const requirements = await insertId(
    db,
    "insert into public.requirements (user_id, application_id, kind, document_id) values ($1, $2, 'resume_cv', $3) returning id",
    [userId, applications, documents],
  );
  const recommenders = await insertId(
    db,
    'insert into public.recommenders (user_id, name) values ($1, $2) returning id',
    [userId, `${name}'s advisor`],
  );
  const recommendation_requests = await insertId(
    db,
    'insert into public.recommendation_requests (user_id, recommender_id, application_id) values ($1, $2, $3) returning id',
    [userId, recommenders, applications],
  );
  const funding = await insertId(
    db,
    "insert into public.funding (user_id, application_id, name, kind) values ($1, $2, $3, 'fellowship') returning id",
    [userId, applications, `${name} Fellowship`],
  );
  const tasks = await insertId(
    db,
    'insert into public.tasks (user_id, application_id, title) values ($1, $2, $3) returning id',
    [userId, applications, `${name} task`],
  );
  return {
    userId,
    universities,
    applications,
    documents,
    requirements,
    recommenders,
    recommendation_requests,
    funding,
    tasks,
  };
}
