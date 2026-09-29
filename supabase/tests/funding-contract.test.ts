import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CURRENCIES } from '../../src/features/applications/labels';
import {
  emptyFundingValues,
  fundingFormSchema,
  fundingValuesFromRow,
} from '../../src/features/funding/form';
import { FUNDING_KIND_VALUES, FUNDING_STATUS_VALUES } from '../../src/features/funding/kinds';
import { fundingRowSchema, type FundingFields } from '../../src/features/funding/types';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The funding screens and the table behind them are two halves of one contract: what the form
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

/** What the browser would submit for the form (a ticked checkbox is "on"), with some fields filled in. */
function item(overrides: Record<string, string | undefined> = {}): FundingFields {
  // A checkbox that is not ticked is left out of the form data altogether.
  const values = Object.entries(emptyFundingValues()).filter(
    ([name]) => name !== 'application_required',
  );
  return fundingFormSchema.parse({
    ...Object.fromEntries(values),
    name: 'Departmental fellowship',
    ...overrides,
  });
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

/** Adds an item the way the API does (no owner sent) and returns it as PostgREST would. */
async function addFunding(tx: Transaction, fields: FundingFields) {
  const inserted = await tx.query<{ json: string }>(
    `with saved as (
       insert into public.funding
         (application_id, name, kind, amount, currency, deadline, application_required, status,
          url, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *
     )
     select to_jsonb(saved)::text as json from saved`,
    [
      fields.application_id,
      fields.name,
      fields.kind,
      fields.amount,
      fields.currency,
      fields.deadline,
      fields.application_required,
      fields.status,
      fields.url,
      fields.notes,
    ],
  );
  return fundingRowSchema.parse(JSON.parse(inserted.rows[0]!.json));
}

describe('what the form produces is accepted by the table and read back correctly', () => {
  it('handles the smallest possible item', async () => {
    const row = await asCaller(db, asUser, (tx) => addFunding(tx, item()));
    expect(row).toMatchObject({
      application_id: null,
      name: 'Departmental fellowship',
      kind: 'university_scholarship',
      amount: null,
      currency: 'USD',
      deadline: null,
      application_required: false,
      status: 'researching',
      url: null,
      notes: null,
    });
  });

  it('handles an item with every field filled in, and returns the same values', async () => {
    const row = await asCaller(db, asUser, async (tx) => {
      const program = await newApplication(tx);
      return addFunding(
        tx,
        item({
          application_id: program,
          name: '  Knight-Hennessy   Scholars ',
          kind: 'fellowship',
          amount: '90,000.50',
          currency: 'EUR',
          deadline: '2026-12-01',
          application_required: 'on',
          status: 'applying',
          url: 'stanford.edu/kh',
          notes: 'Essay due first.\nInterview in January.',
        }),
      );
    });
    expect(row).toMatchObject({
      name: 'Knight-Hennessy Scholars',
      kind: 'fellowship',
      amount: 90_000.5,
      currency: 'EUR',
      deadline: '2026-12-01',
      application_required: true,
      status: 'applying',
      url: 'https://stanford.edu/kh',
      notes: 'Essay due first.\nInterview in January.',
    });
    expect(row.application_id).not.toBeNull();
    // Opening it again to edit shows what was typed, tidied.
    expect(fundingValuesFromRow(row)).toMatchObject({
      name: 'Knight-Hennessy Scholars',
      amount: '90000.5',
      currency: 'EUR',
      deadline: '2026-12-01',
      application_required: true,
      url: 'https://stanford.edu/kh',
    });
  });

  it('accepts the longest and largest values the form allows', async () => {
    const row = await asCaller(db, asUser, (tx) =>
      addFunding(
        tx,
        item({
          name: 'n'.repeat(200),
          amount: '1,000,000',
          notes: 'x'.repeat(10_000),
          url: `https://example.edu/${'a'.repeat(2000)}`,
        }),
      ),
    );
    expect(row.name).toHaveLength(200);
    expect(row.amount).toBe(1_000_000);
    expect(row.notes).toHaveLength(10_000);
  });

  it('keeps the exact cents of an amount', async () => {
    const amounts = ['0', '0.01', '19.99', '1234.56', '999999.99'];
    const rows = await asCaller(db, asUser, async (tx) => {
      const saved = [];
      for (const amount of amounts) saved.push(await addFunding(tx, item({ amount })));
      return saved;
    });
    expect(rows.map((row) => row.amount)).toEqual([0, 0.01, 19.99, 1234.56, 999_999.99]);
  });

  it('accepts every type and every status the app offers', async () => {
    const rows = await asCaller(db, asUser, async (tx) => {
      const saved = [];
      for (const kind of FUNDING_KIND_VALUES) saved.push(await addFunding(tx, item({ kind })));
      for (const status of FUNDING_STATUS_VALUES) {
        saved.push(await addFunding(tx, item({ status })));
      }
      return saved;
    });
    expect(rows.slice(0, FUNDING_KIND_VALUES.length).map((row) => row.kind)).toEqual(
      FUNDING_KIND_VALUES,
    );
    expect(rows.slice(FUNDING_KIND_VALUES.length).map((row) => row.status)).toEqual(
      FUNDING_STATUS_VALUES,
    );
  });

  it('accepts every currency the form offers', async () => {
    const rows = await asCaller(db, asUser, async (tx) => {
      const saved = [];
      for (const currency of CURRENCIES) saved.push(await addFunding(tx, item({ currency })));
      return saved;
    });
    expect(rows.map((row) => row.currency)).toEqual([...CURRENCIES]);
  });

  it('fills in the owner from the signed-in person', async () => {
    const owners = await asCaller(db, asUser, async (tx) => {
      await addFunding(tx, item());
      return tx.query<{ user_id: string }>('select user_id from public.funding');
    });
    expect(owners.rows.map((row) => row.user_id)).toEqual([USER_A]);
  });
});

describe('the app and the database agree on the allowed values', () => {
  it('funding_kind has exactly the types the app knows', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.funding_kind))::text as label',
    );
    expect(rows.map((row) => row.label).sort()).toEqual([...FUNDING_KIND_VALUES].sort());
  });

  it('funding_status has exactly the statuses the app knows', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.funding_status))::text as label',
    );
    expect(rows.map((row) => row.label).sort()).toEqual([...FUNDING_STATUS_VALUES].sort());
  });
});

describe('the database refuses what the form would also refuse', () => {
  const refuses = (patch: Partial<FundingFields>, code: string) =>
    expect(
      asCaller(db, asUser, (tx) => addFunding(tx, { ...item(), ...patch })),
    ).rejects.toMatchObject({ code });

  it('a name that is empty, blank or over 200 characters', async () => {
    for (const name of ['', '   ', 'x'.repeat(201)]) await refuses({ name }, '23514');
  });

  it('notes over 10,000 characters', async () => {
    await refuses({ notes: 'x'.repeat(10_001) }, '23514');
  });

  it('a negative amount, and one too large to store', async () => {
    await refuses({ amount: -1 }, '23514');
    await refuses({ amount: 10_000_000_000 }, '22003');
  });

  it('a currency that is not three capital letters', async () => {
    for (const currency of ['', 'US', 'usd', 'USDX', 'U$D', '123']) {
      await refuses({ currency }, '23514');
    }
  });

  it('a link that is not a web address', async () => {
    for (const url of ['javascript:alert(1)', 'ftp://example.edu', 'example.edu', 'https://a b']) {
      await refuses({ url }, '23514');
    }
  });

  it('a date that does not exist, a type or a status it does not know', async () => {
    await refuses({ deadline: '2026-02-30' }, '22008');
    await refuses({ kind: 'lottery' as FundingFields['kind'] }, '22P02');
    await refuses({ status: 'on_fire' as FundingFields['status'] }, '22P02');
  });

  it('a program that does not exist', async () => {
    await refuses({ application_id: '99999999-9999-4999-8999-999999999999' }, '23503');
  });
});

describe('what happens around funding', () => {
  it('does not need a program', async () => {
    const row = await asCaller(db, asUser, (tx) => addFunding(tx, item({ name: 'Outside grant' })));
    expect(row.application_id).toBeNull();
  });

  it('lets a program have several items, and an item be moved to another program or none', async () => {
    const moved = await asCaller(db, asUser, async (tx) => {
      const one = await newApplication(tx);
      const two = await newApplication(tx);
      const first = await addFunding(tx, item({ application_id: one, name: 'First' }));
      await addFunding(tx, item({ application_id: one, name: 'Second' }));
      await tx.query('update public.funding set application_id = $1 where id = $2', [
        two,
        first.id,
      ]);
      const afterMove = await tx.query<{ name: string; application_id: string | null }>(
        'select name, application_id from public.funding order by name',
      );
      await tx.query('update public.funding set application_id = null where id = $1', [first.id]);
      const afterDetach = await tx.query<{ application_id: string | null }>(
        'select application_id from public.funding where id = $1',
        [first.id],
      );
      return {
        afterMove: afterMove.rows,
        afterDetach: afterDetach.rows[0]!.application_id,
        one,
        two,
      };
    });
    expect(moved.afterMove).toEqual([
      { name: 'First', application_id: moved.two },
      { name: 'Second', application_id: moved.one },
    ]);
    expect(moved.afterDetach).toBeNull();
  });

  it('removes a program’s funding together with the program, and nobody else’s', async () => {
    const remaining = await asCaller(db, asUser, async (tx) => {
      const doomed = await newApplication(tx);
      const kept = await newApplication(tx);
      await addFunding(tx, item({ application_id: doomed, name: 'Doomed one' }));
      await addFunding(tx, item({ application_id: doomed, name: 'Doomed two' }));
      await addFunding(tx, item({ application_id: kept, name: 'Kept' }));
      await addFunding(tx, item({ name: 'Outside grant' }));
      await tx.query('delete from public.applications where id = $1', [doomed]);
      const { rows } = await tx.query<{ name: string }>(
        'select name from public.funding order by name',
      );
      return rows.map((row) => row.name);
    });
    expect(remaining).toEqual(['Kept', 'Outside grant']);
  });

  it('keeps the program when one item is deleted', async () => {
    const programs = await asCaller(db, asUser, async (tx) => {
      const program = await newApplication(tx);
      const saved = await addFunding(tx, item({ application_id: program }));
      await tx.query('delete from public.funding where id = $1', [saved.id]);
      return tx.query('select id from public.applications where id = $1', [program]);
    });
    expect(programs.rows).toHaveLength(1);
  });

  it('changes only the status when the status is changed', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const saved = await addFunding(tx, item({ amount: '500', status: 'applied', notes: 'n' }));
      await tx.query("update public.funding set status = 'accepted' where id = $1", [saved.id]);
      const { rows } = await tx.query<{ json: string }>(
        'select to_jsonb(f)::text as json from public.funding f where id = $1',
        [saved.id],
      );
      return fundingRowSchema.parse(JSON.parse(rows[0]!.json));
    });
    expect(after).toMatchObject({ status: 'accepted', amount: 500, notes: 'n' });
  });

  it('notes when an item last changed', async () => {
    const stamp = await asCaller(db, asUser, async (tx) => {
      // The clock stands still inside a transaction, so start the row off in the past.
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.funding (name, kind, updated_at) values ('A', 'other', '2020-01-01') returning id",
      );
      await tx.query("update public.funding set status = 'offered' where id = $1", [rows[0]!.id]);
      const updated = await tx.query<{ updated_at: string }>(
        'select updated_at::text from public.funding where id = $1',
        [rows[0]!.id],
      );
      return updated.rows[0]!.updated_at;
    });
    expect(Date.parse(stamp)).toBeGreaterThan(Date.parse('2026-01-01'));
  });
});

describe('who can see and change what', () => {
  const BOB_UNIVERSITY = '00000000-0000-4000-8000-0000000000d1';
  const BOB_PROGRAM = '00000000-0000-4000-8000-0000000000d2';
  const BOB_ITEM = '00000000-0000-4000-8000-0000000000d3';

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
      `insert into public.funding (id, user_id, application_id, name, kind)
       values ($1, $2, $3, 'Bob’s fellowship', 'fellowship')`,
      [BOB_ITEM, USER_B, BOB_PROGRAM],
    );
  }
  async function cleanBob() {
    await db.query('delete from public.funding where user_id = $1', [USER_B]);
    await db.query('delete from public.applications where user_id = $1', [USER_B]);
    await db.query('delete from public.universities where user_id = $1', [USER_B]);
  }

  it('shows each person only their own funding', async () => {
    await seedBob();
    try {
      const seenByA = await asCaller(db, asUser, async (tx) => {
        await addFunding(tx, item({ name: 'Ada’s scholarship' }));
        const { rows } = await tx.query<{ name: string }>('select name from public.funding');
        return rows.map((row) => row.name);
      });
      expect(seenByA).toEqual(['Ada’s scholarship']);

      const seenByB = await asCaller(db, { role: 'authenticated', userId: USER_B }, async (tx) => {
        const { rows } = await tx.query<{ name: string }>('select name from public.funding');
        return rows.map((row) => row.name);
      });
      expect(seenByB).toEqual(['Bob’s fellowship']);
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone change or delete another person’s funding', async () => {
    await seedBob();
    try {
      const outcome = await asCaller(db, asUser, async (tx) => {
        const renamed = await tx.query(
          "update public.funding set name = 'Hacked' where id = $1 returning id",
          [BOB_ITEM],
        );
        const moved = await tx.query(
          "update public.funding set status = 'accepted' where id = $1 returning id",
          [BOB_ITEM],
        );
        const deleted = await tx.query('delete from public.funding where id = $1 returning id', [
          BOB_ITEM,
        ]);
        return [renamed.rows.length, moved.rows.length, deleted.rows.length];
      });
      expect(outcome).toEqual([0, 0, 0]);
      const { rows } = await db.query<{ name: string; status: string }>(
        'select name, status from public.funding where id = $1',
        [BOB_ITEM],
      );
      expect(rows[0]).toEqual({ name: 'Bob’s fellowship', status: 'researching' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone attach their funding to another person’s program', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, asUser, (tx) => addFunding(tx, { ...item(), application_id: BOB_PROGRAM })),
      ).rejects.toMatchObject({ code: '23503' });
      // Nor move one they already have over to it.
      await expect(
        asCaller(db, asUser, async (tx) => {
          const mine = await addFunding(tx, item());
          await tx.query('update public.funding set application_id = $1 where id = $2', [
            BOB_PROGRAM,
            mine.id,
          ]);
        }),
      ).rejects.toMatchObject({ code: '23503' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone save funding in another person’s name', async () => {
    await expect(
      asCaller(db, asUser, (tx) =>
        tx.query(
          "insert into public.funding (user_id, name, kind) values ($1, 'Sneaky', 'other')",
          [USER_B],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      asCaller(db, asUser, async (tx) => {
        const mine = await addFunding(tx, item());
        await tx.query('update public.funding set user_id = $1 where id = $2', [USER_B, mine.id]);
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('shows nothing at all to someone who is not signed in', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, { role: 'anon' }, (tx) => tx.query('select id from public.funding')),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await cleanBob();
    }
  });
});
