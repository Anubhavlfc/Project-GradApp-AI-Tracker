import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  emptyRequirementValues,
  requirementFormSchema,
  requirementValuesFromRow,
} from '../../src/features/requirements/form';
import {
  COMMON_REQUIREMENTS,
  REQUIREMENT_KIND_VALUES,
  REQUIREMENT_STATUS_VALUES,
} from '../../src/features/requirements/kinds';
import {
  requirementRowSchema,
  type RequirementFields,
} from '../../src/features/requirements/types';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The checklist screens and the requirements table are two halves of one contract: what the form
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

/** What the browser would submit for the add/edit form, with some fields filled in. */
function submit(overrides: Record<string, string | boolean> = {}): RequirementFields {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...emptyRequirementValues(), ...overrides })) {
    if (value === true) values[key] = 'on';
    else if (value !== false) values[key] = value;
  }
  return requirementFormSchema.parse(values);
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

const COLUMNS = 'application_id, kind, label, is_required, status, due_date, notes';

/** Adds items the way the API does (one insert, no owner sent) and returns them as PostgREST would. */
async function add(tx: Transaction, applicationId: string, items: readonly RequirementFields[]) {
  const params: unknown[] = [];
  const tuples = items.map((item) => {
    params.push(
      applicationId,
      item.kind,
      item.label,
      item.is_required,
      item.status,
      item.due_date,
      item.notes,
    );
    const base = params.length - 7;
    return `(${Array.from({ length: 7 }, (_, index) => `$${base + index + 1}`).join(', ')})`;
  });
  const inserted = await tx.query<{ json: string }>(
    `with saved as (
       insert into public.requirements (${COLUMNS}) values ${tuples.join(', ')} returning *
     )
     select to_jsonb(saved)::text as json from saved order by created_at, id`,
    params,
  );
  return inserted.rows.map((row) => requirementRowSchema.parse(JSON.parse(row.json)));
}

describe('what the form produces is accepted by the table and read back correctly', () => {
  it('handles the smallest possible item', async () => {
    const [row] = await asCaller(db, asUser, async (tx) =>
      add(tx, await newApplication(tx), [submit()]),
    );
    expect(row).toMatchObject({
      kind: 'resume_cv',
      label: null,
      is_required: true,
      status: 'not_started',
      due_date: null,
      document_id: null,
      notes: null,
    });
  });

  it('handles an item with every field filled in, and returns the same values', async () => {
    const input = submit({
      kind: 'recommendation_letter',
      label: 'Recommendation   Letter 2',
      status: 'in_progress',
      is_required: false,
      due_date: '2027-01-10',
      notes: 'Ask Prof. Chen.\nRemind her in December.',
    });
    expect(input.label).toBe('Recommendation Letter 2');
    const [row] = await asCaller(db, asUser, async (tx) =>
      add(tx, await newApplication(tx), [input]),
    );
    expect(row).toMatchObject(input);
    expect(requirementValuesFromRow(row!)).toMatchObject({
      kind: 'recommendation_letter',
      label: 'Recommendation Letter 2',
      status: 'in_progress',
      is_required: false,
      due_date: '2027-01-10',
    });
  });

  it('accepts the longest values the form allows', async () => {
    const [row] = await asCaller(db, asUser, async (tx) =>
      add(tx, await newApplication(tx), [
        submit({ kind: 'other', label: 'x'.repeat(200), notes: 'n'.repeat(10_000) }),
      ]),
    );
    expect(row!.label).toHaveLength(200);
    expect(row!.notes).toHaveLength(10_000);
  });

  it('accepts every type and every status the app offers', async () => {
    const rows = await asCaller(db, asUser, async (tx) => {
      const application = await newApplication(tx);
      return add(tx, application, [
        ...REQUIREMENT_KIND_VALUES.map((kind) => submit({ kind, label: `type ${kind}` })),
        ...REQUIREMENT_STATUS_VALUES.map((status) => submit({ status, label: `status ${status}` })),
      ]);
    });
    expect(rows).toHaveLength(REQUIREMENT_KIND_VALUES.length + REQUIREMENT_STATUS_VALUES.length);
  });

  it('accepts everything in the "common requirements" list', async () => {
    const rows = await asCaller(db, asUser, async (tx) =>
      add(
        tx,
        await newApplication(tx),
        COMMON_REQUIREMENTS.map((item) =>
          submit({ kind: item.kind, label: item.label ?? '', is_required: true }),
        ),
      ),
    );
    expect(rows).toHaveLength(COMMON_REQUIREMENTS.length);
  });

  it('lets a program have several items of the same type', async () => {
    const rows = await asCaller(db, asUser, async (tx) =>
      add(tx, await newApplication(tx), [
        submit({ kind: 'recommendation_letter', label: 'Recommendation Letter 1' }),
        submit({ kind: 'recommendation_letter', label: 'Recommendation Letter 2' }),
        submit({ kind: 'recommendation_letter', label: 'Recommendation Letter 2' }),
      ]),
    );
    expect(rows).toHaveLength(3);
  });

  it('fills in the owner from the signed-in person', async () => {
    const owners = await asCaller(db, asUser, async (tx) => {
      const application = await newApplication(tx);
      await add(tx, application, [submit()]);
      return tx.query<{ user_id: string }>('select user_id from public.requirements');
    });
    expect(owners.rows.map((row) => row.user_id)).toEqual([USER_A]);
  });
});

describe('the app and the database agree on the allowed values', () => {
  async function enumLabels(type: string) {
    const { rows } = await db.query<{ label: string }>(
      `select unnest(enum_range(null::public.${type}))::text as label`,
    );
    return rows.map((row) => row.label);
  }

  it.each([
    ['requirement_kind', REQUIREMENT_KIND_VALUES],
    ['requirement_status', REQUIREMENT_STATUS_VALUES],
  ])('%s has exactly the values the app knows', async (type, appValues) => {
    expect((await enumLabels(type)).sort()).toEqual([...appValues].sort());
  });
});

describe('the database refuses what the form would also refuse', () => {
  it('a name of more than 200 characters', async () => {
    await expect(
      asCaller(db, asUser, async (tx) =>
        add(tx, await newApplication(tx), [{ ...submit(), label: 'x'.repeat(201) }]),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('notes of more than 10,000 characters', async () => {
    await expect(
      asCaller(db, asUser, async (tx) =>
        add(tx, await newApplication(tx), [{ ...submit(), notes: 'n'.repeat(10_001) }]),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('a type or status it does not know', async () => {
    for (const patch of [{ kind: 'astrology' }, { status: 'on_fire' }]) {
      await expect(
        asCaller(db, asUser, async (tx) =>
          add(tx, await newApplication(tx), [{ ...submit(), ...patch } as RequirementFields]),
        ),
      ).rejects.toMatchObject({ code: '22P02' });
    }
  });

  it('an item without a program, or on a program that does not exist', async () => {
    await expect(
      asCaller(db, asUser, async (tx) =>
        tx.query("insert into public.requirements (kind) values ('gre')"),
      ),
    ).rejects.toMatchObject({ code: '23502' });
    await expect(
      asCaller(db, asUser, async (tx) =>
        add(tx, '99999999-9999-4999-8999-999999999999', [submit()]),
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('a whole batch, when one item in it is refused: none of it is saved', async () => {
    const application = await asCaller(db, asUser, async (tx) => {
      const id = await newApplication(tx);
      // Same shape as the API's single insert, with the third item invalid.
      await expect(
        add(tx, id, [
          submit({ kind: 'transcript' }),
          submit({ kind: 'gre' }),
          { ...submit(), label: 'x'.repeat(201) },
        ]),
      ).rejects.toMatchObject({ code: '23514' });
      return id;
    });
    // The failed statement rolled back with its transaction (and so did the whole test).
    const { rows } = await db.query(
      'select id from public.requirements where application_id = $1',
      [application],
    );
    expect(rows).toHaveLength(0);
  });
});

describe('what happens around a checklist', () => {
  it('removes a program’s checklist together with the program', async () => {
    const remaining = await asCaller(db, asUser, async (tx) => {
      const doomed = await newApplication(tx);
      const kept = await newApplication(tx);
      await add(tx, doomed, [submit({ kind: 'gre' }), submit({ kind: 'toefl' })]);
      await add(tx, kept, [submit({ kind: 'transcript' })]);
      await tx.query('delete from public.applications where id = $1', [doomed]);
      const { rows } = await tx.query<{ kind: string }>('select kind from public.requirements');
      return rows.map((row) => row.kind);
    });
    expect(remaining).toEqual(['transcript']);
  });

  it('notes when an item last changed', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const application = await newApplication(tx);
      // The clock stands still inside a transaction, so start the item off in the past.
      const inserted = await tx.query<{ id: string }>(
        `insert into public.requirements (application_id, kind, updated_at)
         values ($1, 'gre', '2020-01-01') returning id`,
        [application],
      );
      const id = inserted.rows[0]!.id;
      await tx.query("update public.requirements set status = 'complete' where id = $1", [id]);
      const { rows } = await tx.query<{ updated_at: string; status: string }>(
        'select updated_at::text, status from public.requirements where id = $1',
        [id],
      );
      return rows[0]!;
    });
    expect(after.status).toBe('complete');
    expect(Date.parse(after.updated_at)).toBeGreaterThan(Date.parse('2026-01-01'));
  });

  it('shows each person only their own checklist', async () => {
    // B has a program and an item of their own; A must see none of it, and B none of A's.
    await db.query('insert into public.universities (id, user_id, name) values ($1, $2, $3)', [
      '00000000-0000-4000-8000-0000000000b1',
      USER_B,
      'Bob University',
    ]);
    await db.query(
      `insert into public.applications (id, user_id, university_id, program_name)
       values ($1, $2, $3, 'Bob MS')`,
      ['00000000-0000-4000-8000-0000000000b2', USER_B, '00000000-0000-4000-8000-0000000000b1'],
    );
    await db.query(
      `insert into public.requirements (user_id, application_id, kind)
       values ($1, $2, 'portfolio')`,
      [USER_B, '00000000-0000-4000-8000-0000000000b2'],
    );
    try {
      const seenByA = await asCaller(db, asUser, async (tx) => {
        await add(tx, await newApplication(tx), [submit({ kind: 'gre' })]);
        const { rows } = await tx.query<{ kind: string }>('select kind from public.requirements');
        return rows.map((row) => row.kind);
      });
      expect(seenByA).toEqual(['gre']);

      const seenByB = await asCaller(db, { role: 'authenticated', userId: USER_B }, async (tx) => {
        const { rows } = await tx.query<{ kind: string }>('select kind from public.requirements');
        return rows.map((row) => row.kind);
      });
      expect(seenByB).toEqual(['portfolio']);
    } finally {
      await db.query('delete from public.applications where user_id = $1', [USER_B]);
      await db.query('delete from public.universities where user_id = $1', [USER_B]);
    }
  });
});
