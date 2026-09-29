import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { universityKey } from '../../src/features/applications/api';
import { applicationFormSchema, emptyFormValues } from '../../src/features/applications/form';
import {
  DEGREE_LEVEL_VALUES,
  FEE_WAIVER_VALUES,
  PRIORITY_VALUES,
} from '../../src/features/applications/labels';
import { STATUS_VALUES } from '../../src/features/applications/status';
import {
  applicationRecordSchema,
  type ApplicationInput,
} from '../../src/features/applications/types';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The app and the database are two halves of one contract: what the form produces must be
// accepted by the tables, and what the tables return must be what the screens expect. These
// tests run the real migrations and the real form validation against each other, so a change to
// either side that breaks the other fails here instead of in front of a user.

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

/** What the browser would submit for the form, with some fields filled in. */
function submit(overrides: Record<string, string | boolean> = {}): ApplicationInput {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries({
    ...emptyFormValues(),
    university_name: 'Stanford University',
    program_name: 'Computer Science',
    ...overrides,
  })) {
    if (value === true) values[key] = 'on';
    else if (value !== false) values[key] = value;
  }
  return applicationFormSchema.parse(values);
}

const asUser = { role: 'authenticated', userId: USER_A } as const;

/** Saves a program the way the API does (university first, then the program), as user A. */
async function save(tx: Transaction, input: ApplicationInput): Promise<Record<string, unknown>> {
  const { name, city, region, country, website_url } = input.university;
  const university = await tx.query<{ id: string }>(
    `insert into public.universities (name, city, region, country, website_url)
     values ($1, $2, $3, $4, $5) returning id`,
    [name, city, region, country, website_url],
  );
  const columns = Object.keys(input.application);
  const values = Object.values(input.application);
  const inserted = await tx.query<{ json: string }>(
    // Same JSON shape PostgREST returns for `select=*,university:universities(*)`.
    `with saved as (
       insert into public.applications (university_id, ${columns.join(', ')})
       values ($1, ${columns.map((_, index) => `$${index + 2}`).join(', ')})
       returning *
     )
     select (to_jsonb(saved) || jsonb_build_object('university', to_jsonb(u)))::text as json
     from saved join public.universities u on u.id = saved.university_id`,
    [university.rows[0]!.id, ...values],
  );
  return JSON.parse(inserted.rows[0]!.json) as Record<string, unknown>;
}

describe('what the form produces is accepted by the tables and read back correctly', () => {
  it('handles the smallest possible program', async () => {
    const record = await asCaller(db, asUser, async (tx) => save(tx, submit()));
    const parsed = applicationRecordSchema.parse(record);
    expect(parsed).toMatchObject({
      program_name: 'Computer Science',
      status: 'researching',
      degree_level: 'masters',
      is_favorite: false,
      fee_currency: 'USD',
      fee_waiver_status: 'not_requested',
    });
    expect(parsed.university.name).toBe('Stanford University');
  });

  it('handles a program with every field filled in, and returns the same values', async () => {
    const input = submit({
      university_name: 'Massachusetts Institute of Technology',
      university_city: 'Cambridge',
      university_region: 'MA',
      university_country: 'United States',
      university_website_url: 'mit.edu',
      school_college: 'School of Engineering',
      department: 'EECS',
      program_name: 'Artificial Intelligence',
      degree_level: 'phd',
      degree_type: 'PhD',
      program_url: 'https://www.eecs.mit.edu/academics/graduate-programs/',
      program_length_months: '60',
      is_stem: true,
      status: 'accepted',
      priority: 'dream',
      deadline: '2026-12-15',
      priority_deadline: '2026-12-01',
      portal_url: 'apply.mit.edu/start',
      application_fee: '1,075.50',
      fee_currency: 'CAD',
      fee_waiver_available: true,
      fee_waiver_status: 'granted',
      fee_paid_on: '2026-11-20',
      submitted_on: '2026-11-21',
      interview_at: '2027-02-10T14:30',
      decision_received_on: '2027-03-15',
      decision_deadline: '2027-04-15',
      enrollment_deposit: '500',
      is_final_choice: true,
      notes: 'Talk to Prof. Chen.\nAsk about funding.',
    });
    const record = await asCaller(db, asUser, async (tx) => save(tx, input));
    const parsed = applicationRecordSchema.parse(record);

    expect(parsed).toMatchObject({
      ...input.application,
      // Stored as a moment in time; the database may write the same moment in another format.
      interview_at: expect.any(String),
    });
    expect(new Date(parsed.interview_at!).toISOString()).toBe(input.application.interview_at);
    expect(parsed.application_fee).toBe(1075.5);
    expect(parsed.university).toMatchObject(input.university);
  });

  it('accepts the longest values the form allows', async () => {
    const input = submit({
      university_name: 'U'.repeat(200),
      university_city: 'c'.repeat(100),
      university_region: 'r'.repeat(100),
      university_country: 'x'.repeat(100),
      university_website_url: `https://example.edu/${'a'.repeat(2048 - 'https://example.edu/'.length)}`,
      school_college: 's'.repeat(200),
      department: 'd'.repeat(200),
      program_name: 'P'.repeat(200),
      degree_type: 't'.repeat(50),
      program_length_months: '120',
      application_fee: '1000000',
      enrollment_deposit: '1000000.00',
      deadline: '2100-12-31',
      notes: 'n'.repeat(10_000),
    });
    const record = await asCaller(db, asUser, async (tx) => save(tx, input));
    expect(applicationRecordSchema.parse(record).program_name).toHaveLength(200);
  });

  it('accepts every status, degree level, priority and waiver status the app offers', async () => {
    await asCaller(db, asUser, async (tx) => {
      for (const status of STATUS_VALUES) {
        await save(tx, submit({ university_name: `Uni ${status}`, status }));
      }
      for (const degree_level of DEGREE_LEVEL_VALUES) {
        await save(tx, submit({ university_name: `Uni ${degree_level}`, degree_level }));
      }
      for (const priority of PRIORITY_VALUES) {
        await save(tx, submit({ university_name: `Uni ${priority}`, priority }));
      }
      for (const fee_waiver_status of FEE_WAIVER_VALUES) {
        await save(
          tx,
          submit({
            university_name: `Uni ${fee_waiver_status}`,
            fee_waiver_available: true,
            fee_waiver_status,
          }),
        );
      }
    });
  });

  it('lets the same university be reused for several programs', async () => {
    await asCaller(db, asUser, async (tx) => {
      const first = await save(tx, submit());
      const second = await tx.query(
        `insert into public.applications (university_id, program_name) values ($1, 'Statistics')`,
        [first.university_id],
      );
      expect(second.affectedRows).toBe(1);
    });
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
    ['application_status', STATUS_VALUES],
    ['degree_level', DEGREE_LEVEL_VALUES],
    ['application_priority', PRIORITY_VALUES],
    ['fee_waiver_status', FEE_WAIVER_VALUES],
  ])('%s has exactly the values the app knows', async (type, appValues) => {
    expect((await enumLabels(type)).sort()).toEqual([...appValues].sort());
  });
});

describe('the database refuses what the form would also refuse', () => {
  async function failsWith(code: string, statement: string, params: unknown[] = []) {
    await expect(
      asCaller(db, asUser, async (tx) => {
        const university = await tx.query<{ id: string }>(
          "insert into public.universities (name) values ('Guard University') returning id",
        );
        await tx.query(statement, [university.rows[0]!.id, ...params]);
      }),
    ).rejects.toMatchObject({ code });
  }

  it('a priority deadline after the final deadline', async () => {
    await failsWith(
      '23514',
      `insert into public.applications (university_id, program_name, deadline, priority_deadline)
       values ($1, 'X', '2026-12-01', '2026-12-15')`,
    );
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.edu', 'not a url'])(
    'a web address of %j',
    async (url) => {
      await failsWith(
        '23514',
        `insert into public.applications (university_id, program_name, portal_url)
         values ($1, 'X', $2)`,
        [url],
      );
    },
  );

  it('a negative fee', async () => {
    await failsWith(
      '23514',
      `insert into public.applications (university_id, program_name, application_fee)
       values ($1, 'X', -1)`,
    );
  });

  it('a blank program name', async () => {
    await failsWith(
      '23514',
      `insert into public.applications (university_id, program_name) values ($1, '   ')`,
    );
  });

  it('a program length outside 1 to 120 months', async () => {
    await failsWith(
      '23514',
      `insert into public.applications (university_id, program_name, program_length_months)
       values ($1, 'X', 0)`,
    );
  });
});

describe('university names', () => {
  it.each([
    ['Stanford University', 'stanford university'],
    ['Stanford University', '  Stanford University  '],
    ['MIT', 'mit'],
    ['UC Berkeley', 'uc berkeley '],
  ])('the app treats %j and %j as the same university, and so does the database', async (a, b) => {
    expect(universityKey(a)).toBe(universityKey(b));
    await expect(
      asCaller(db, asUser, async (tx) => {
        await tx.query('insert into public.universities (name) values ($1)', [a]);
        await tx.query('insert into public.universities (name) values ($1)', [b]);
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('different universities are kept apart, and each person has their own list', async () => {
    expect(universityKey('Stanford')).not.toBe(universityKey('Stanford University'));
    await asCaller(db, asUser, async (tx) => {
      await tx.query(
        "insert into public.universities (name) values ('Stanford'), ('Stanford University')",
      );
    });
    // Another user may have a university with the same name.
    await asCaller(db, { role: 'authenticated', userId: USER_B }, async (tx) => {
      await tx.query("insert into public.universities (name) values ('Stanford')");
    });
  });
});
