import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  emptyRecommenderValues,
  emptyRequestValues,
  recommenderFormSchema,
  recommenderValuesFromRow,
  requestFormSchema,
  requestValuesFromRow,
} from '../../src/features/recommendations/form';
import { RECOMMENDATION_STATUS_VALUES } from '../../src/features/recommendations/statuses';
import {
  recommenderRowSchema,
  requestRowSchema,
  type RecommenderFields,
  type RequestFields,
} from '../../src/features/recommendations/types';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The recommender screens and the two tables behind them are two halves of one contract: what the
// forms produce must be accepted by the tables, and what the tables return must be what the
// screens expect. These tests run the real migrations and the real form validation against each
// other.

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

/** What the browser would submit for the recommender form, with some fields filled in. */
function person(overrides: Record<string, string> = {}): RecommenderFields {
  return recommenderFormSchema.parse({
    ...emptyRecommenderValues(),
    name: 'Dr. Lee',
    ...overrides,
  });
}

/** What the browser would submit for the request form, with some fields filled in. */
function letter(overrides: Record<string, string> = {}): RequestFields {
  return requestFormSchema.parse({
    recommender_id: 'someone',
    application_id: 'somewhere',
    ...emptyRequestValues(),
    ...overrides,
  }).fields;
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

/** Adds a recommender the way the API does (no owner sent) and returns them as PostgREST would. */
async function addPerson(tx: Transaction, fields: RecommenderFields) {
  const inserted = await tx.query<{ json: string }>(
    `with saved as (
       insert into public.recommenders (name, title, institution, email, notes)
       values ($1, $2, $3, $4, $5) returning *
     )
     select to_jsonb(saved)::text as json from saved`,
    [fields.name, fields.title, fields.institution, fields.email, fields.notes],
  );
  return recommenderRowSchema.parse(JSON.parse(inserted.rows[0]!.json));
}

/** Adds a letter request the same way. */
async function addLetter(
  tx: Transaction,
  recommenderId: string,
  applicationId: string,
  fields: RequestFields = letter(),
) {
  const inserted = await tx.query<{ json: string }>(
    `with saved as (
       insert into public.recommendation_requests
         (recommender_id, application_id, status, requested_on, deadline, notes)
       values ($1, $2, $3, $4, $5, $6) returning *
     )
     select to_jsonb(saved)::text as json from saved`,
    [
      recommenderId,
      applicationId,
      fields.status,
      fields.requested_on,
      fields.deadline,
      fields.notes,
    ],
  );
  return requestRowSchema.parse(JSON.parse(inserted.rows[0]!.json));
}

describe('what the recommender form produces is accepted by the table and read back correctly', () => {
  it('handles the smallest possible person', async () => {
    const row = await asCaller(db, asUser, (tx) => addPerson(tx, person()));
    expect(row).toMatchObject({
      name: 'Dr. Lee',
      title: null,
      institution: null,
      email: null,
      notes: null,
    });
  });

  it('handles a person with every field filled in, and returns the same values', async () => {
    const input = person({
      name: '  Dr.   Jane   Lee ',
      title: 'Associate Professor',
      institution: 'MIT',
      email: 'jane.lee+letters@mit.edu',
      notes: 'Knows me from CS 101.\nPrefers email.',
    });
    expect(input.name).toBe('Dr. Jane Lee');
    const row = await asCaller(db, asUser, (tx) => addPerson(tx, input));
    expect(row).toMatchObject(input);
    expect(recommenderValuesFromRow(row)).toMatchObject({
      name: 'Dr. Jane Lee',
      email: 'jane.lee+letters@mit.edu',
    });
  });

  it('accepts the longest values the form allows', async () => {
    const row = await asCaller(db, asUser, (tx) =>
      addPerson(
        tx,
        person({
          name: 'n'.repeat(200),
          title: 't'.repeat(200),
          institution: 'i'.repeat(200),
          email: `${'a'.repeat(64)}@${'b'.repeat(180)}.edu`,
          notes: 'x'.repeat(10_000),
        }),
      ),
    );
    expect(row.name).toHaveLength(200);
    expect(row.notes).toHaveLength(10_000);
    expect(row.email!.length).toBeLessThanOrEqual(254);
  });

  it('accepts every email address the form accepts', async () => {
    const addresses = ['a@b.co', 'first.last@sub.example.edu', 'x+tag@uw.edu', "o'brien@mit.edu"];
    await asCaller(db, asUser, async (tx) => {
      for (const email of addresses) {
        expect((await addPerson(tx, person({ email }))).email).toBe(email);
      }
    });
  });

  it('fills in the owner from the signed-in person', async () => {
    const owners = await asCaller(db, asUser, async (tx) => {
      await addPerson(tx, person());
      return tx.query<{ user_id: string }>('select user_id from public.recommenders');
    });
    expect(owners.rows.map((row) => row.user_id)).toEqual([USER_A]);
  });
});

describe('what the request form produces is accepted by the table and read back correctly', () => {
  it('handles the smallest possible request', async () => {
    const row = await asCaller(db, asUser, async (tx) => {
      const who = await addPerson(tx, person());
      return addLetter(tx, who.id, await newApplication(tx));
    });
    expect(row).toMatchObject({
      status: 'not_requested',
      requested_on: null,
      deadline: null,
      notes: null,
    });
  });

  it('handles a request with every field filled in, and returns the same values', async () => {
    const input = letter({
      status: 'requested',
      requested_on: '2026-10-03',
      deadline: '2026-12-01',
      notes: 'Asked in person.\nSent my CV.',
    });
    const row = await asCaller(db, asUser, async (tx) => {
      const who = await addPerson(tx, person());
      return addLetter(tx, who.id, await newApplication(tx), input);
    });
    expect(row).toMatchObject(input);
    expect(requestValuesFromRow(row)).toEqual({
      status: 'requested',
      requested_on: '2026-10-03',
      deadline: '2026-12-01',
      notes: 'Asked in person.\nSent my CV.',
    });
  });

  it('accepts every status the app offers', async () => {
    const rows = await asCaller(db, asUser, async (tx) => {
      const who = await addPerson(tx, person());
      const created = [];
      for (const status of RECOMMENDATION_STATUS_VALUES) {
        created.push(await addLetter(tx, who.id, await newApplication(tx), letter({ status })));
      }
      return created;
    });
    expect(rows.map((row) => row.status)).toEqual(RECOMMENDATION_STATUS_VALUES);
  });

  it('lets one person write for several programs, and a program have several writers', async () => {
    const count = await asCaller(db, asUser, async (tx) => {
      const first = await addPerson(tx, person({ name: 'First' }));
      const second = await addPerson(tx, person({ name: 'Second' }));
      const one = await newApplication(tx);
      const two = await newApplication(tx);
      await addLetter(tx, first.id, one);
      await addLetter(tx, first.id, two);
      await addLetter(tx, second.id, one);
      const { rows } = await tx.query<{ count: number }>(
        'select count(*)::int as count from public.recommendation_requests',
      );
      return rows[0]!.count;
    });
    expect(count).toBe(3);
  });

  it('fills in the owner from the signed-in person', async () => {
    const owners = await asCaller(db, asUser, async (tx) => {
      const who = await addPerson(tx, person());
      await addLetter(tx, who.id, await newApplication(tx));
      return tx.query<{ user_id: string }>('select user_id from public.recommendation_requests');
    });
    expect(owners.rows.map((row) => row.user_id)).toEqual([USER_A]);
  });
});

describe('the app and the database agree on the allowed values', () => {
  it('recommendation_status has exactly the statuses the app knows', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.recommendation_status))::text as label',
    );
    expect(rows.map((row) => row.label).sort()).toEqual([...RECOMMENDATION_STATUS_VALUES].sort());
  });
});

describe('the database refuses what the forms would also refuse', () => {
  it('a name that is empty, blank or over 200 characters', async () => {
    for (const name of ['', '   ', 'x'.repeat(201)]) {
      await expect(
        asCaller(db, asUser, (tx) => addPerson(tx, { ...person(), name })),
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('a title or institution over 200 characters, and notes over 10,000', async () => {
    for (const patch of [
      { title: 'x'.repeat(201) },
      { institution: 'x'.repeat(201) },
      { notes: 'x'.repeat(10_001) },
    ]) {
      await expect(
        asCaller(db, asUser, (tx) => addPerson(tx, { ...person(), ...patch })),
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('something that is not an email address', async () => {
    for (const email of [
      'jane',
      'jane@',
      '@mit.edu',
      'jane@mit',
      'jane lee@mit.edu',
      'a@b@c.edu',
    ]) {
      await expect(
        asCaller(db, asUser, (tx) => addPerson(tx, { ...person(), email })),
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('request notes over 10,000 characters and a status it does not know', async () => {
    await expect(
      asCaller(db, asUser, async (tx) => {
        const who = await addPerson(tx, person());
        return addLetter(tx, who.id, await newApplication(tx), {
          ...letter(),
          notes: 'x'.repeat(10_001),
        });
      }),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      asCaller(db, asUser, async (tx) => {
        const who = await addPerson(tx, person());
        return addLetter(tx, who.id, await newApplication(tx), {
          ...letter(),
          status: 'on_fire' as RequestFields['status'],
        });
      }),
    ).rejects.toMatchObject({ code: '22P02' });
  });

  it('a second request from the same person for the same program', async () => {
    await expect(
      asCaller(db, asUser, async (tx) => {
        const who = await addPerson(tx, person());
        const program = await newApplication(tx);
        await addLetter(tx, who.id, program);
        return addLetter(tx, who.id, program);
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('a request for a person or a program that does not exist', async () => {
    const nobody = '99999999-9999-4999-8999-999999999999';
    await expect(
      asCaller(db, asUser, async (tx) => addLetter(tx, nobody, await newApplication(tx))),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      asCaller(db, asUser, async (tx) => {
        const who = await addPerson(tx, person());
        return addLetter(tx, who.id, nobody);
      }),
    ).rejects.toMatchObject({ code: '23503' });
  });
});

describe('what happens around a recommender', () => {
  it('removes a person’s requests together with the person, and nobody else’s', async () => {
    const remaining = await asCaller(db, asUser, async (tx) => {
      const doomed = await addPerson(tx, person({ name: 'Doomed' }));
      const kept = await addPerson(tx, person({ name: 'Kept' }));
      const program = await newApplication(tx);
      const other = await newApplication(tx);
      await addLetter(tx, doomed.id, program);
      await addLetter(tx, doomed.id, other);
      await addLetter(tx, kept.id, program);
      await tx.query('delete from public.recommenders where id = $1', [doomed.id]);
      const { rows } = await tx.query<{ name: string }>(
        `select r.name from public.recommendation_requests q
         join public.recommenders r on r.id = q.recommender_id`,
      );
      return rows.map((row) => row.name);
    });
    expect(remaining).toEqual(['Kept']);
  });

  it('removes a program’s requests together with the program, and keeps the people', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const who = await addPerson(tx, person());
      const doomed = await newApplication(tx);
      const kept = await newApplication(tx);
      await addLetter(tx, who.id, doomed);
      await addLetter(tx, who.id, kept);
      await tx.query('delete from public.applications where id = $1', [doomed]);
      const requests = await tx.query<{ application_id: string }>(
        'select application_id from public.recommendation_requests',
      );
      const people = await tx.query('select id from public.recommenders');
      return {
        requests: requests.rows.map((row) => row.application_id),
        people: people.rows.length,
        kept,
      };
    });
    expect(after.requests).toEqual([after.kept]);
    expect(after.people).toBe(1);
  });

  it('keeps the person when one request is deleted', async () => {
    const people = await asCaller(db, asUser, async (tx) => {
      const who = await addPerson(tx, person());
      const request = await addLetter(tx, who.id, await newApplication(tx));
      await tx.query('delete from public.recommendation_requests where id = $1', [request.id]);
      return tx.query('select id from public.recommenders');
    });
    expect(people.rows).toHaveLength(1);
  });

  it('notes when a person or a request last changed', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      // The clock stands still inside a transaction, so start the rows off in the past.
      const who = await tx.query<{ id: string }>(
        "insert into public.recommenders (name, updated_at) values ('Dr. Lee', '2020-01-01') returning id",
      );
      const program = await newApplication(tx);
      const request = await tx.query<{ id: string }>(
        `insert into public.recommendation_requests (recommender_id, application_id, updated_at)
         values ($1, $2, '2020-01-01') returning id`,
        [who.rows[0]!.id, program],
      );
      await tx.query("update public.recommenders set title = 'Prof' where id = $1", [
        who.rows[0]!.id,
      ]);
      await tx.query(
        "update public.recommendation_requests set status = 'submitted' where id = $1",
        [request.rows[0]!.id],
      );
      const people = await tx.query<{ updated_at: string }>(
        'select updated_at::text from public.recommenders',
      );
      const requests = await tx.query<{ updated_at: string }>(
        'select updated_at::text from public.recommendation_requests',
      );
      return [people.rows[0]!.updated_at, requests.rows[0]!.updated_at];
    });
    for (const stamp of after) expect(Date.parse(stamp)).toBeGreaterThan(Date.parse('2026-01-01'));
  });
});

describe('who can see and change what', () => {
  const BOB_PERSON = '00000000-0000-4000-8000-0000000000c1';
  const BOB_UNIVERSITY = '00000000-0000-4000-8000-0000000000c2';
  const BOB_PROGRAM = '00000000-0000-4000-8000-0000000000c3';

  async function seedBob() {
    await db.query('insert into public.recommenders (id, user_id, name) values ($1, $2, $3)', [
      BOB_PERSON,
      USER_B,
      'Bob’s recommender',
    ]);
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
      `insert into public.recommendation_requests (user_id, recommender_id, application_id)
       values ($1, $2, $3)`,
      [USER_B, BOB_PERSON, BOB_PROGRAM],
    );
  }
  async function cleanBob() {
    await db.query('delete from public.recommenders where user_id = $1', [USER_B]);
    await db.query('delete from public.applications where user_id = $1', [USER_B]);
    await db.query('delete from public.universities where user_id = $1', [USER_B]);
  }

  it('shows each person only their own recommenders and requests', async () => {
    await seedBob();
    try {
      const seenByA = await asCaller(db, asUser, async (tx) => {
        const who = await addPerson(tx, person({ name: 'Ada’s recommender' }));
        await addLetter(tx, who.id, await newApplication(tx));
        const people = await tx.query<{ name: string }>('select name from public.recommenders');
        const requests = await tx.query('select id from public.recommendation_requests');
        return { people: people.rows.map((row) => row.name), requests: requests.rows.length };
      });
      expect(seenByA).toEqual({ people: ['Ada’s recommender'], requests: 1 });

      const seenByB = await asCaller(db, { role: 'authenticated', userId: USER_B }, async (tx) => {
        const people = await tx.query<{ name: string }>('select name from public.recommenders');
        const requests = await tx.query('select id from public.recommendation_requests');
        return { people: people.rows.map((row) => row.name), requests: requests.rows.length };
      });
      expect(seenByB).toEqual({ people: ['Bob’s recommender'], requests: 1 });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone change or delete another person’s recommender or request', async () => {
    await seedBob();
    try {
      const outcome = await asCaller(db, asUser, async (tx) => {
        const renamed = await tx.query(
          "update public.recommenders set name = 'Hacked' where id = $1 returning id",
          [BOB_PERSON],
        );
        const deleted = await tx.query(
          'delete from public.recommenders where id = $1 returning id',
          [BOB_PERSON],
        );
        const changed = await tx.query(
          `update public.recommendation_requests set status = 'submitted'
           where recommender_id = $1 returning id`,
          [BOB_PERSON],
        );
        return [renamed.rows.length, deleted.rows.length, changed.rows.length];
      });
      expect(outcome).toEqual([0, 0, 0]);
      const { rows } = await db.query<{ name: string }>(
        'select name from public.recommenders where id = $1',
        [BOB_PERSON],
      );
      expect(rows[0]!.name).toBe('Bob’s recommender');
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone attach their request to another person’s recommender or program', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, asUser, async (tx) => addLetter(tx, BOB_PERSON, await newApplication(tx))),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        asCaller(db, asUser, async (tx) => {
          const mine = await addPerson(tx, person());
          return addLetter(tx, mine.id, BOB_PROGRAM);
        }),
      ).rejects.toMatchObject({ code: '23503' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone save a recommender in another person’s name', async () => {
    await expect(
      asCaller(db, asUser, (tx) =>
        tx.query("insert into public.recommenders (user_id, name) values ($1, 'Sneaky')", [USER_B]),
      ),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('shows nothing at all to someone who is not signed in', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, { role: 'anon' }, (tx) => tx.query('select id from public.recommenders')),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        asCaller(db, { role: 'anon' }, (tx) =>
          tx.query('select id from public.recommendation_requests'),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await cleanBob();
    }
  });
});
