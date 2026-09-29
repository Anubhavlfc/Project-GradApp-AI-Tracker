import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asCaller, createDatabase, seedUser, USER_A, USER_B, type Graph } from './support/db';

// These tests are the proof that one user can never read or change another user's data. They run
// the real migrations against Postgres (PGlite) using the same roles and JWT mechanism Supabase
// uses, so a policy mistake fails `npm test` before it can reach a real project.

const userOwnedTables = [
  'universities',
  'applications',
  'documents',
  'requirements',
  'recommenders',
  'recommendation_requests',
  'funding',
  'tasks',
] as const;

const everyTable = ['profiles', 'activity', ...userOwnedTables] as const;

let db: PGlite;
let a: Graph;
let b: Graph;

beforeAll(async () => {
  db = await createDatabase();
  a = await seedUser(db, USER_A, 'Alice');
  b = await seedUser(db, USER_B, 'Bob');
});

afterAll(async () => {
  await db.close();
});

const asA = { role: 'authenticated', userId: USER_A } as const;
const asB = { role: 'authenticated', userId: USER_B } as const;

describe('reading', () => {
  it.each(userOwnedTables)('%s: a user sees only their own rows', async (table) => {
    const rows = await asCaller(
      db,
      asA,
      async (tx) =>
        (await tx.query<{ user_id: string }>(`select user_id from public.${table}`)).rows,
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.user_id === USER_A)).toBe(true);
  });

  it.each(userOwnedTables)("%s: another user's row cannot be fetched by id", async (table) => {
    const rows = await asCaller(
      db,
      asA,
      async (tx) =>
        (await tx.query(`select id from public.${table} where id = $1`, [b[table]])).rows,
    );
    expect(rows).toHaveLength(0);
  });

  it('profiles and activity are private too', async () => {
    const { profiles, activity } = await asCaller(db, asA, async (tx) => ({
      profiles: (await tx.query<{ id: string }>('select id from public.profiles')).rows,
      activity: (await tx.query<{ user_id: string }>('select user_id from public.activity')).rows,
    }));
    expect(profiles.map((row) => row.id)).toEqual([USER_A]);
    expect(activity.length).toBeGreaterThan(0);
    expect(activity.every((row) => row.user_id === USER_A)).toBe(true);
  });

  it('a signed-in user with no data sees nothing', async () => {
    const stranger = {
      role: 'authenticated',
      userId: '33333333-3333-4333-8333-333333333333',
    } as const;
    for (const table of everyTable) {
      const rows = await asCaller(
        db,
        stranger,
        async (tx) => (await tx.query(`select 1 from public.${table}`)).rows,
      );
      expect(rows, table).toHaveLength(0);
    }
  });

  it.each(everyTable)('%s: the anon role has no access at all', async (table) => {
    await expect(
      asCaller(db, { role: 'anon' }, (tx) => tx.query(`select * from public.${table}`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("changing another user's rows", () => {
  it.each(userOwnedTables)('%s: update affects nothing', async (table) => {
    const result = await asCaller(db, asA, (tx) =>
      tx.query(`update public.${table} set updated_at = now() where id = $1`, [b[table]]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it.each(userOwnedTables)('%s: delete affects nothing', async (table) => {
    const result = await asCaller(db, asA, (tx) =>
      tx.query(`delete from public.${table} where id = $1`, [b[table]]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it.each(userOwnedTables)('%s: cannot insert a row owned by someone else', async (table) => {
    await expect(
      asCaller(db, asA, async (tx) => {
        const columns = await tx.query<{ column_name: string }>(
          `select column_name from information_schema.columns
            where table_schema = 'public' and table_name = $1
              and column_name not in ('id', 'user_id', 'created_at', 'updated_at')
            order by ordinal_position`,
          [table],
        );
        const list = columns.rows.map((row) => row.column_name).join(', ');
        // Copy Alice's own row (so every column is valid) but claim Bob as the owner.
        await tx.query(
          `insert into public.${table} (user_id, ${list})
           select $1, ${list} from public.${table} where user_id = $2 limit 1`,
          [USER_B, USER_A],
        );
      }),
    ).rejects.toThrow(/row-level security/);
  });

  it.each(userOwnedTables)('%s: cannot hand a row to someone else', async (table) => {
    await expect(
      asCaller(db, asA, (tx) =>
        tx.query(`update public.${table} set user_id = $1 where id = $2`, [USER_B, a[table]]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('own rows get the caller as owner by default', async () => {
    const owner = await asCaller(db, asA, async (tx) => {
      const inserted = await tx.query<{ user_id: string }>(
        "insert into public.documents (name, kind) values ('New doc', 'cv') returning user_id",
      );
      return inserted.rows[0]?.user_id;
    });
    expect(owner).toBe(USER_A);
  });
});

describe('links between rows', () => {
  const attempts = (): Record<string, [string, unknown[]]> => ({
    "application -> another user's university": [
      "insert into public.applications (university_id, program_name) values ($1, 'Sneaky')",
      [b.universities],
    ],
    "requirement -> another user's application": [
      "insert into public.requirements (application_id, kind) values ($1, 'other')",
      [b.applications],
    ],
    "requirement -> another user's document": [
      "insert into public.requirements (application_id, kind, document_id) values ($1, 'other', $2)",
      [a.applications, b.documents],
    ],
    "recommendation request -> another user's application": [
      'insert into public.recommendation_requests (recommender_id, application_id) values ($1, $2)',
      [a.recommenders, b.applications],
    ],
    "recommendation request -> another user's recommender": [
      'insert into public.recommendation_requests (recommender_id, application_id) values ($1, $2)',
      [b.recommenders, a.applications],
    ],
    "funding -> another user's application": [
      "insert into public.funding (application_id, name, kind) values ($1, 'x', 'other')",
      [b.applications],
    ],
    "task -> another user's application": [
      "insert into public.tasks (application_id, title) values ($1, 'x')",
      [b.applications],
    ],
  });

  const attemptNames = [
    "application -> another user's university",
    "requirement -> another user's application",
    "requirement -> another user's document",
    "recommendation request -> another user's application",
    "recommendation request -> another user's recommender",
    "funding -> another user's application",
    "task -> another user's application",
  ];

  it.each(attemptNames)('rejects %s', async (name) => {
    const [sql, params] = attempts()[name] as [string, unknown[]];
    await expect(
      asCaller(db, asA, async (tx) => {
        await tx.query(sql, params);
        // Some foreign keys are deferred to commit (the test rolls back); check them now.
        await tx.exec('set constraints all immediate');
      }),
    ).rejects.toThrow(/foreign key/);
  });

  it("allows the same links between a user's own rows", async () => {
    const id = await asCaller(db, asA, async (tx) => {
      const inserted = await tx.query<{ id: string }>(
        "insert into public.tasks (application_id, title) values ($1, 'ok') returning id",
        [a.applications],
      );
      await tx.exec('set constraints all immediate');
      return inserted.rows[0]?.id;
    });
    expect(id).toBeTruthy();
  });
});

describe('privileges', () => {
  it('lets clients read but never write the activity log', async () => {
    for (const sql of [
      "insert into public.activity (user_id, kind, subject) values (auth.uid(), 'application_added', 'x')",
      "update public.activity set subject = 'forged'",
      'delete from public.activity',
    ]) {
      await expect(
        asCaller(db, asA, (tx) => tx.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('does not let clients create or remove profiles', async () => {
    await expect(
      asCaller(db, asA, (tx) =>
        tx.query('insert into public.profiles (id) values (gen_random_uuid())'),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asCaller(db, asA, (tx) => tx.query('delete from public.profiles')),
    ).rejects.toThrow(/permission denied/);
  });

  it('lets users edit only their own display name', async () => {
    const changed = await asCaller(db, asA, async (tx) => {
      const own = await tx.query(
        "update public.profiles set display_name = 'Alice A.' where id = $1",
        [USER_A],
      );
      const others = await tx.query(
        "update public.profiles set display_name = 'hacked' where id = $1",
        [USER_B],
      );
      return { own: own.affectedRows, others: others.affectedRows };
    });
    expect(changed).toEqual({ own: 1, others: 0 });
    await expect(
      asCaller(db, asA, (tx) => tx.query('update public.profiles set id = gen_random_uuid()')),
    ).rejects.toThrow(/permission denied/);
  });

  it('cannot truncate tables (TRUNCATE ignores row level security)', async () => {
    for (const table of everyTable) {
      await expect(
        asCaller(db, asA, (tx) => tx.query(`truncate public.${table} cascade`)),
        table,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('keeps every function but account deletion out of the API', async () => {
    const functions = await db.query<{ proname: string; anon: boolean; authenticated: boolean }>(
      `select p.proname,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'`,
    );
    expect(functions.rows.length).toBeGreaterThan(0);
    for (const fn of functions.rows) {
      expect(fn.anon, fn.proname).toBe(false);
      // The one function meant for the API: a person deleting their own account.
      expect(fn.authenticated, fn.proname).toBe(fn.proname === 'delete_my_account');
    }
  });
});

describe('guards for future migrations', () => {
  it('every table in public has row level security enabled', async () => {
    const result = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity`,
    );
    expect(result.rows).toEqual([]);
  });

  it('every table in public has at least one policy', async () => {
    const result = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
          and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)`,
    );
    expect(result.rows).toEqual([]);
  });

  it('the guard tests cover every table that exists', async () => {
    const result = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
    );
    expect(result.rows.map((row) => row.relname)).toEqual([...everyTable].sort());
  });

  it('clients only hold the privileges they need', async () => {
    const result = await db.query<{ table_name: string; grantee: string; privilege_type: string }>(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated')`,
    );
    expect(result.rows.filter((row) => row.grantee === 'anon')).toEqual([]);
    const allowed = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE']);
    expect(result.rows.filter((row) => !allowed.has(row.privilege_type))).toEqual([]);
  });
});

describe('automatic behavior', () => {
  it('creates a profile when a user signs up, using their name', async () => {
    const result = await db.query<{ display_name: string | null }>(
      'select display_name from public.profiles where id = $1',
      [USER_B],
    );
    expect(result.rows[0]?.display_name).toBe('Bob');
  });

  it('logs when applications are added, change status, and are removed', async () => {
    const activity = await asCaller(db, asA, async (tx) => {
      const university = await tx.query<{ id: string }>(
        "insert into public.universities (name) values ('Stanford University') returning id",
      );
      const application = await tx.query<{ id: string }>(
        "insert into public.applications (university_id, program_name) values ($1, 'MS Computer Science') returning id",
        [university.rows[0]?.id],
      );
      const id = application.rows[0]?.id;
      await tx.query("update public.applications set status = 'submitted' where id = $1", [id]);
      await tx.query("update public.applications set notes = 'no status change' where id = $1", [
        id,
      ]);
      await tx.query('delete from public.applications where id = $1', [id]);
      const log = await tx.query<{
        kind: string;
        subject: string;
        detail: string | null;
        application_id: string | null;
      }>(
        `select kind, subject, detail, application_id from public.activity
          where subject like 'Stanford%' order by created_at, kind`,
      );
      return log.rows;
    });
    const subject = 'Stanford University, MS Computer Science';
    expect(activity.map((row) => [row.kind, row.subject, row.detail])).toEqual(
      expect.arrayContaining([
        ['application_added', subject, null],
        ['status_changed', subject, 'submitted'],
        ['application_removed', subject, null],
      ]),
    );
    expect(activity).toHaveLength(3);
    expect(activity.find((row) => row.kind === 'application_removed')?.application_id).toBeNull();
  });

  it("does not show one user's activity to another", async () => {
    const rows = await asCaller(
      db,
      asB,
      async (tx) =>
        (await tx.query<{ subject: string }>('select subject from public.activity')).rows,
    );
    expect(
      rows.every((row) => !row.subject.startsWith('Alice') && !row.subject.startsWith('Stanford')),
    ).toBe(true);
  });

  it('stamps completed_at when a task is completed and clears it when reopened', async () => {
    const states = await asCaller(db, asA, async (tx) => {
      const read = async () =>
        (
          await tx.query<{ done: boolean }>(
            'select completed_at is not null as done from public.tasks where id = $1',
            [a.tasks],
          )
        ).rows[0]?.done;
      const before = await read();
      await tx.query("update public.tasks set status = 'complete' where id = $1", [a.tasks]);
      const completed = await read();
      await tx.query("update public.tasks set status = 'in_progress' where id = $1", [a.tasks]);
      const reopened = await read();
      return { before, completed, reopened };
    });
    expect(states).toEqual({ before: false, completed: true, reopened: false });
  });

  it('bumps updated_at on update', async () => {
    const before = await db.query<{ updated_at: Date }>(
      'select updated_at from public.documents where id = $1',
      [a.documents],
    );
    await db.query('select pg_sleep(0.05)');
    await db.query("update public.documents set notes = 'changed' where id = $1", [a.documents]);
    const after = await db.query<{ updated_at: Date }>(
      'select updated_at from public.documents where id = $1',
      [a.documents],
    );
    expect(after.rows[0]!.updated_at.getTime()).toBeGreaterThan(
      before.rows[0]!.updated_at.getTime(),
    );
    await db.query('update public.documents set notes = null where id = $1', [a.documents]);
  });
});

describe('data quality', () => {
  // [description, statement that sets a bad value on one of Alice's rows, which table's row]
  const invalid: [string, string, 'applications' | 'recommenders' | 'funding' | 'tasks'][] = [
    [
      'negative application fee',
      'update public.applications set application_fee = -1 where id = $1',
      'applications',
    ],
    [
      'lowercase currency',
      "update public.applications set fee_currency = 'usd' where id = $1",
      'applications',
    ],
    [
      'javascript: link',
      "update public.applications set portal_url = 'javascript:alert(1)' where id = $1",
      'applications',
    ],
    [
      'link without a scheme',
      "update public.applications set program_url = 'stanford.edu' where id = $1",
      'applications',
    ],
    [
      'link with spaces',
      "update public.applications set program_url = 'https://a.edu/x y' where id = $1",
      'applications',
    ],
    [
      'priority deadline after deadline',
      "update public.applications set deadline = '2026-12-01', priority_deadline = '2026-12-15' where id = $1",
      'applications',
    ],
    [
      'zero-month program',
      'update public.applications set program_length_months = 0 where id = $1',
      'applications',
    ],
    [
      'unknown status',
      "update public.applications set status = 'maybe' where id = $1",
      'applications',
    ],
    [
      'blank program name',
      "update public.applications set program_name = '   ' where id = $1",
      'applications',
    ],
    [
      'oversized notes',
      "update public.applications set notes = repeat('x', 10001) where id = $1",
      'applications',
    ],
    [
      'malformed recommender email',
      "update public.recommenders set email = 'not-an-email' where id = $1",
      'recommenders',
    ],
    ['negative funding amount', 'update public.funding set amount = -500 where id = $1', 'funding'],
    ['impossible date', "update public.tasks set due_date = '2026-02-30' where id = $1", 'tasks'],
    ['blank task title', "update public.tasks set title = '' where id = $1", 'tasks'],
  ];

  it.each(invalid)('rejects %s', async (_name, sql, table) => {
    await expect(asCaller(db, asA, (tx) => tx.query(sql, [a[table]]))).rejects.toThrow();
  });

  it('accepts valid values', async () => {
    await asCaller(db, asA, async (tx) => {
      await tx.query(
        `update public.applications
            set application_fee = 125.5, fee_currency = 'USD', portal_url = 'https://apply.stanford.edu/x?y=1',
                deadline = '2026-12-02', priority_deadline = '2026-11-15', program_length_months = 24
          where id = $1`,
        [a.applications],
      );
      await tx.query("update public.recommenders set email = 'prof.smith@uni.edu' where id = $1", [
        a.recommenders,
      ]);
    });
  });

  it('treats university names as unique per user, ignoring case and spacing', async () => {
    await expect(
      asCaller(db, asA, (tx) =>
        tx.query("insert into public.universities (name) values ('  alice UNIVERSITY ')"),
      ),
    ).rejects.toThrow(/duplicate key/);
    // ...but a different user may use the same name.
    await asCaller(db, asB, (tx) =>
      tx.query("insert into public.universities (name) values ('Alice University')"),
    );
  });

  it('will not delete a university that still has applications', async () => {
    await expect(
      asCaller(db, asA, async (tx) => {
        await tx.query('delete from public.universities where id = $1', [a.universities]);
        await tx.exec('set constraints all immediate');
      }),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('deleting an account', () => {
  it("removes all of that user's data and nobody else's", async () => {
    const leaver = await seedUser(db, '44444444-4444-4444-8444-444444444444', 'Carol');
    await db.query('delete from auth.users where id = $1', [leaver.userId]);

    for (const table of everyTable) {
      const column = table === 'profiles' ? 'id' : 'user_id';
      const gone = await db.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where ${column} = $1`,
        [leaver.userId],
      );
      expect(gone.rows[0]?.n, table).toBe(0);
    }
    for (const table of userOwnedTables) {
      const kept = await db.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where user_id = $1`,
        [USER_B],
      );
      expect(kept.rows[0]?.n, table).toBeGreaterThan(0);
    }
  });
});
