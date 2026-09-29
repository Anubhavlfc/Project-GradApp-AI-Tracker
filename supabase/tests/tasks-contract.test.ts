import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { emptyTaskValues, taskFormSchema, taskValuesFromRow } from '../../src/features/tasks/form';
import { TASK_PRIORITY_VALUES, TASK_STATUS_VALUES } from '../../src/features/tasks/kinds';
import { taskRowSchema, type TaskFields } from '../../src/features/tasks/types';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The task screens and the table behind them are two halves of one contract: what the form
// produces must be accepted by the table, and what the table returns must be what the screens
// expect. These tests run the real migrations and the real form validation against each other.

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

const asUser = { role: 'authenticated', userId: USER_A } as const;

/** What the browser would submit for the form, with some fields filled in. */
function item(overrides: Record<string, string | undefined> = {}): TaskFields {
  return taskFormSchema.parse({
    ...emptyTaskValues(),
    title: 'Email Prof. Lee',
    ...overrides,
  });
}

/** Adds a task the way the API does (no owner sent) and returns it as PostgREST would. */
async function addTask(tx: Transaction, fields: TaskFields) {
  const inserted = await tx.query<{ json: string }>(
    `with saved as (
       insert into public.tasks (application_id, title, due_date, priority, status, notes)
       values ($1, $2, $3, $4, $5, $6) returning *
     )
     select to_jsonb(saved)::text as json from saved`,
    [
      fields.application_id,
      fields.title,
      fields.due_date,
      fields.priority,
      fields.status,
      fields.notes,
    ],
  );
  return taskRowSchema.parse(JSON.parse(inserted.rows[0]!.json));
}

/** A task as the database has it now. */
async function readTask(tx: Transaction, id: string) {
  const { rows } = await tx.query<{ json: string }>(
    'select to_jsonb(t)::text as json from public.tasks t where id = $1',
    [id],
  );
  return taskRowSchema.parse(JSON.parse(rows[0]!.json));
}

let universities = 0;

/** A program of the signed-in person's, at a university of its own. */
async function newApplication(tx: Transaction): Promise<string> {
  universities += 1;
  const university = await tx.query<{ id: string }>(
    'insert into public.universities (name) values ($1) returning id',
    [`University ${universities}`],
  );
  const application = await tx.query<{ id: string }>(
    "insert into public.applications (university_id, program_name) values ($1, 'CS') returning id",
    [university.rows[0]!.id],
  );
  return application.rows[0]!.id;
}

describe('what the form produces is accepted by the table and read back correctly', () => {
  it('handles the smallest possible task', async () => {
    const row = await asCaller(db, asUser, (tx) => addTask(tx, item()));
    expect(row).toMatchObject({
      application_id: null,
      title: 'Email Prof. Lee',
      due_date: null,
      priority: 'medium',
      status: 'todo',
      completed_at: null,
      notes: null,
    });
  });

  it('handles a task with every field filled in, and returns the same values', async () => {
    const row = await asCaller(db, asUser, async (tx) =>
      addTask(
        tx,
        item({
          application_id: await newApplication(tx),
          title: '  Order   official transcripts ',
          due_date: '2026-11-30',
          priority: 'high',
          status: 'in_progress',
          notes: 'Registrar closes at 4.\nBring ID.',
        }),
      ),
    );
    expect(row).toMatchObject({
      title: 'Order official transcripts',
      due_date: '2026-11-30',
      priority: 'high',
      status: 'in_progress',
      notes: 'Registrar closes at 4.\nBring ID.',
    });
    expect(row.application_id).not.toBeNull();
    // Opening it again to edit shows what was typed, tidied.
    expect(taskValuesFromRow(row)).toMatchObject({
      title: 'Order official transcripts',
      due_date: '2026-11-30',
      priority: 'high',
      status: 'in_progress',
    });
  });

  it('accepts the longest values the form allows', async () => {
    const row = await asCaller(db, asUser, (tx) =>
      addTask(tx, item({ title: 't'.repeat(300), notes: 'x'.repeat(10_000) })),
    );
    expect(row.title).toHaveLength(300);
    expect(row.notes).toHaveLength(10_000);
  });

  it('accepts every priority and every status the app offers', async () => {
    const rows = await asCaller(db, asUser, async (tx) => {
      const saved = [];
      for (const priority of TASK_PRIORITY_VALUES)
        saved.push(await addTask(tx, item({ priority })));
      for (const status of TASK_STATUS_VALUES) saved.push(await addTask(tx, item({ status })));
      return saved;
    });
    expect(rows.slice(0, TASK_PRIORITY_VALUES.length).map((row) => row.priority)).toEqual(
      TASK_PRIORITY_VALUES,
    );
    expect(rows.slice(TASK_PRIORITY_VALUES.length).map((row) => row.status)).toEqual(
      TASK_STATUS_VALUES,
    );
  });

  it('fills in the owner from the signed-in person', async () => {
    const owners = await asCaller(db, asUser, async (tx) => {
      await addTask(tx, item());
      return tx.query<{ user_id: string }>('select user_id from public.tasks');
    });
    expect(owners.rows.map((row) => row.user_id)).toEqual([USER_A]);
  });
});

describe('the app and the database agree on the allowed values', () => {
  it('task_status has exactly the statuses the app knows', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.task_status))::text as label',
    );
    expect(rows.map((row) => row.label)).toEqual(TASK_STATUS_VALUES);
  });

  it('task_priority has exactly the priorities the app knows, low to high', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.task_priority))::text as label',
    );
    expect(rows.map((row) => row.label)).toEqual(TASK_PRIORITY_VALUES);
  });
});

describe('the database refuses what the form would also refuse', () => {
  const refuses = (patch: Partial<TaskFields>, code: string) =>
    expect(
      asCaller(db, asUser, (tx) => addTask(tx, { ...item(), ...patch })),
    ).rejects.toMatchObject({ code });

  it('a title that is empty, blank or over 300 characters', async () => {
    for (const title of ['', '   ', 'x'.repeat(301)]) await refuses({ title }, '23514');
  });

  it('notes over 10,000 characters', async () => {
    await refuses({ notes: 'x'.repeat(10_001) }, '23514');
  });

  it('a priority or a status it does not know', async () => {
    await refuses({ priority: 'urgent' as TaskFields['priority'] }, '22P02');
    await refuses({ status: 'done' as TaskFields['status'] }, '22P02');
  });

  it('a program that does not exist', async () => {
    await refuses({ application_id: '99999999-9999-4999-8999-999999999999' }, '23503');
  });
});

describe('when a task was completed', () => {
  // The clock stands still inside a transaction, so old timestamps are set by hand and compared
  // with "now".
  const longAgo = '2020-01-01T00:00:00Z';

  it('is noted when a task is added already complete', async () => {
    const row = await asCaller(db, asUser, (tx) => addTask(tx, item({ status: 'complete' })));
    expect(row.completed_at).not.toBeNull();
  });

  it('is noted when a task becomes complete, and cleared when it is reopened', async () => {
    const states = await asCaller(db, asUser, async (tx) => {
      const saved = await addTask(tx, item());
      const start = (await readTask(tx, saved.id)).completed_at;
      await tx.query("update public.tasks set status = 'complete' where id = $1", [saved.id]);
      const done = (await readTask(tx, saved.id)).completed_at;
      await tx.query("update public.tasks set status = 'in_progress' where id = $1", [saved.id]);
      const reopened = (await readTask(tx, saved.id)).completed_at;
      return { start, done, reopened };
    });
    expect(states.start).toBeNull();
    expect(states.done).not.toBeNull();
    expect(states.reopened).toBeNull();
  });

  it('is not moved by an edit to a task that is already complete', async () => {
    const stamps = await asCaller(db, asUser, async (tx) => {
      const saved = await addTask(tx, item({ status: 'complete' }));
      await tx.query('update public.tasks set completed_at = $1 where id = $2', [
        longAgo,
        saved.id,
      ]);
      await tx.query("update public.tasks set title = 'Renamed', notes = 'edited' where id = $1", [
        saved.id,
      ]);
      await tx.query("update public.tasks set status = 'complete' where id = $1", [saved.id]);
      return readTask(tx, saved.id);
    });
    expect(Date.parse(stamps.completed_at!)).toBe(Date.parse(longAgo));
    expect(stamps.title).toBe('Renamed');
  });

  it('cannot be set by hand on a task that is not complete', async () => {
    const row = await asCaller(db, asUser, async (tx) => {
      const saved = await addTask(tx, item());
      await tx.query('update public.tasks set completed_at = $1 where id = $2', [
        longAgo,
        saved.id,
      ]);
      return readTask(tx, saved.id);
    });
    expect(row.completed_at).toBeNull();
  });

  it('starts over when a task is completed again after being reopened', async () => {
    const stamp = await asCaller(db, asUser, async (tx) => {
      const saved = await addTask(tx, item({ status: 'complete' }));
      await tx.query('update public.tasks set completed_at = $1 where id = $2', [
        longAgo,
        saved.id,
      ]);
      await tx.query("update public.tasks set status = 'todo' where id = $1", [saved.id]);
      await tx.query("update public.tasks set status = 'complete' where id = $1", [saved.id]);
      return (await readTask(tx, saved.id)).completed_at;
    });
    expect(Date.parse(stamp!)).toBeGreaterThan(Date.parse('2026-01-01'));
  });
});

describe('a task and its program', () => {
  it('can belong to one of your programs, be moved to another, or belong to none', async () => {
    const states = await asCaller(db, asUser, async (tx) => {
      const first = await newApplication(tx);
      const second = await newApplication(tx);
      const saved = await addTask(tx, item({ application_id: first }));
      const read = async () => (await readTask(tx, saved.id)).application_id;
      const start = await read();
      await tx.query('update public.tasks set application_id = $1 where id = $2', [
        second,
        saved.id,
      ]);
      const moved = await read();
      await tx.query('update public.tasks set application_id = null where id = $1', [saved.id]);
      const none = await read();
      return { start, moved, none, first, second };
    });
    expect(states.start).toBe(states.first);
    expect(states.moved).toBe(states.second);
    expect(states.none).toBeNull();
  });

  it('is deleted with its program, while tasks tied to none and to other programs stay', async () => {
    const left = await asCaller(db, asUser, async (tx) => {
      const doomed = await newApplication(tx);
      const kept = await newApplication(tx);
      await addTask(tx, item({ title: 'Goes', application_id: doomed }));
      await addTask(tx, item({ title: 'Goes too', application_id: doomed }));
      await addTask(tx, item({ title: 'Stays with another', application_id: kept }));
      await addTask(tx, item({ title: 'Stays free' }));
      await tx.query('delete from public.applications where id = $1', [doomed]);
      const { rows } = await tx.query<{ title: string }>(
        'select title from public.tasks order by title',
      );
      return rows.map((row) => row.title);
    });
    expect(left).toEqual(['Stays free', 'Stays with another']);
  });

  it('keeps a person’s tasks when only a checklist item on a program is deleted', async () => {
    const count = await asCaller(db, asUser, async (tx) => {
      const program = await newApplication(tx);
      await addTask(tx, item({ application_id: program }));
      const requirement = await tx.query<{ id: string }>(
        "insert into public.requirements (application_id, kind) values ($1, 'gre') returning id",
        [program],
      );
      await tx.query('delete from public.requirements where id = $1', [requirement.rows[0]!.id]);
      return (await tx.query('select id from public.tasks')).rows.length;
    });
    expect(count).toBe(1);
  });
});

describe('what happens around tasks', () => {
  it('changes only the status when the status is changed', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const saved = await addTask(
        tx,
        item({ notes: 'keep me', priority: 'high', due_date: '2026-12-01' }),
      );
      await tx.query("update public.tasks set status = 'in_progress' where id = $1", [saved.id]);
      return readTask(tx, saved.id);
    });
    expect(after).toMatchObject({
      status: 'in_progress',
      notes: 'keep me',
      priority: 'high',
      due_date: '2026-12-01',
      title: 'Email Prof. Lee',
    });
  });

  it('notes when a task last changed', async () => {
    const stamp = await asCaller(db, asUser, async (tx) => {
      // The clock stands still inside a transaction, so start the row off in the past.
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.tasks (title, updated_at) values ('A', '2020-01-01') returning id",
      );
      await tx.query("update public.tasks set status = 'in_progress' where id = $1", [rows[0]!.id]);
      return (await readTask(tx, rows[0]!.id)).updated_at;
    });
    expect(Date.parse(stamp)).toBeGreaterThan(Date.parse('2026-01-01'));
  });
});

describe('who can see and change what', () => {
  const BOB_TASK = '00000000-0000-4000-8000-0000000000f1';
  const BOB_UNIVERSITY = '00000000-0000-4000-8000-0000000000f2';
  const BOB_PROGRAM = '00000000-0000-4000-8000-0000000000f3';

  async function seedBob() {
    await db.query('insert into public.universities (id, user_id, name) values ($1, $2, $3)', [
      BOB_UNIVERSITY,
      USER_B,
      'Bob University',
    ]);
    await db.query(
      `insert into public.applications (id, user_id, university_id, program_name)
       values ($1, $2, $3, 'Bob MS')`,
      [BOB_PROGRAM, USER_B, BOB_UNIVERSITY],
    );
    await db.query(
      "insert into public.tasks (id, user_id, application_id, title) values ($1, $2, $3, 'Bob’s task')",
      [BOB_TASK, USER_B, BOB_PROGRAM],
    );
  }
  async function cleanBob() {
    await db.query('delete from public.tasks where user_id = $1', [USER_B]);
    await db.query('delete from public.applications where user_id = $1', [USER_B]);
    await db.query('delete from public.universities where user_id = $1', [USER_B]);
  }

  it('shows each person only their own tasks', async () => {
    await seedBob();
    try {
      const seenByA = await asCaller(db, asUser, async (tx) => {
        await addTask(tx, item({ title: 'Ada’s task' }));
        const { rows } = await tx.query<{ title: string }>('select title from public.tasks');
        return rows.map((row) => row.title);
      });
      expect(seenByA).toEqual(['Ada’s task']);

      const seenByB = await asCaller(db, { role: 'authenticated', userId: USER_B }, async (tx) => {
        const { rows } = await tx.query<{ title: string }>('select title from public.tasks');
        return rows.map((row) => row.title);
      });
      expect(seenByB).toEqual(['Bob’s task']);
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone change or delete another person’s task', async () => {
    await seedBob();
    try {
      const outcome = await asCaller(db, asUser, async (tx) => {
        const renamed = await tx.query(
          "update public.tasks set title = 'Hacked' where id = $1 returning id",
          [BOB_TASK],
        );
        const completed = await tx.query(
          "update public.tasks set status = 'complete' where id = $1 returning id",
          [BOB_TASK],
        );
        const deleted = await tx.query('delete from public.tasks where id = $1 returning id', [
          BOB_TASK,
        ]);
        return [renamed.rows.length, completed.rows.length, deleted.rows.length];
      });
      expect(outcome).toEqual([0, 0, 0]);
      const { rows } = await db.query<{ title: string; status: string }>(
        'select title, status from public.tasks where id = $1',
        [BOB_TASK],
      );
      expect(rows[0]).toEqual({ title: 'Bob’s task', status: 'todo' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone put a task on another person’s program', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, asUser, (tx) => addTask(tx, item({ application_id: BOB_PROGRAM }))),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        asCaller(db, asUser, async (tx) => {
          const mine = await addTask(tx, item());
          await tx.query('update public.tasks set application_id = $1 where id = $2', [
            BOB_PROGRAM,
            mine.id,
          ]);
        }),
      ).rejects.toMatchObject({ code: '23503' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone save a task in another person’s name', async () => {
    await expect(
      asCaller(db, asUser, (tx) =>
        tx.query("insert into public.tasks (user_id, title) values ($1, 'Sneaky')", [USER_B]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      asCaller(db, asUser, async (tx) => {
        const mine = await addTask(tx, item());
        await tx.query('update public.tasks set user_id = $1 where id = $2', [USER_B, mine.id]);
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('shows and lets a signed-out visitor do nothing', async () => {
    await expect(
      asCaller(db, { role: 'anon' }, (tx) => tx.query('select * from public.tasks')),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      asCaller(db, { role: 'anon' }, (tx) =>
        tx.query("insert into public.tasks (title) values ('Nope')"),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
