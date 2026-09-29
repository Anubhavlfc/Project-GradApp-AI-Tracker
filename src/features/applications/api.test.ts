import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createApplicationsApi } from './api';
import { DataError } from './errors';
import type { ApplicationInput } from './types';

const university = (overrides = {}) => ({
  id: 'uni-1',
  name: 'Stanford University',
  city: 'Stanford',
  region: 'CA',
  country: 'United States',
  website_url: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const application = (overrides = {}) => ({
  id: 'app-1',
  university_id: 'uni-1',
  program_name: 'Computer Science',
  degree_level: 'masters',
  is_stem: false,
  status: 'researching',
  is_favorite: false,
  fee_currency: 'USD',
  fee_waiver_available: false,
  fee_waiver_status: 'not_requested',
  is_final_choice: false,
  school_college: null,
  department: null,
  degree_type: null,
  program_url: null,
  program_length_months: null,
  priority: null,
  deadline: null,
  priority_deadline: null,
  portal_url: null,
  interview_at: null,
  submitted_on: null,
  application_fee: null,
  fee_paid_on: null,
  decision_received_on: null,
  decision_deadline: null,
  enrollment_deposit: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

function input(
  overrides: {
    university?: Partial<ApplicationInput['university']>;
    application?: Partial<ApplicationInput['application']>;
  } = {},
): ApplicationInput {
  return {
    university: {
      name: 'MIT',
      city: null,
      region: null,
      country: null,
      website_url: null,
      ...overrides.university,
    },
    application: {
      school_college: null,
      department: null,
      program_name: 'AI',
      degree_level: 'masters',
      degree_type: null,
      program_url: null,
      program_length_months: null,
      is_stem: false,
      status: 'researching',
      priority: null,
      deadline: null,
      priority_deadline: null,
      portal_url: null,
      interview_at: null,
      submitted_on: null,
      application_fee: null,
      fee_currency: 'USD',
      fee_waiver_available: false,
      fee_waiver_status: 'not_requested',
      fee_paid_on: null,
      decision_received_on: null,
      decision_deadline: null,
      enrollment_deposit: null,
      is_final_choice: false,
      notes: null,
      ...overrides.application,
    },
  };
}

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase(seed);
  return { fake, api: createApplicationsApi(fake.client) };
}

const seeded = () => ({ universities: [university()], applications: [application()] });
const universityNames = (fake: ReturnType<typeof setup>['fake']) =>
  fake.tables.universities!.map((row) => row.name);

describe('list', () => {
  it('returns each program with its university', async () => {
    const { api } = setup(seeded());
    const [record] = await api.list();
    expect(record).toMatchObject({ id: 'app-1', program_name: 'Computer Science' });
    expect(record?.university).toMatchObject({ id: 'uni-1', name: 'Stanford University' });
  });

  it('fetches everything in one request', async () => {
    const { api, fake } = setup(seeded());
    await api.list();
    expect(fake.requests).toEqual(['select applications']);
  });

  it('refuses data that does not look like a program, rather than showing nonsense', async () => {
    const { api } = setup({
      universities: [university()],
      applications: [application({ status: 'on_fire' })],
    });
    await expect(api.list()).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup(seeded());
    fake.failNext('applications', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({
      kind: 'session',
      message: 'Your session expired. Sign in again.',
    });
  });
});

describe('create', () => {
  it('adds the university and the program together', async () => {
    const { api, fake } = setup();
    const record = await api.create(input({ university: { city: 'Cambridge' } }));
    expect(record.university).toMatchObject({ name: 'MIT', city: 'Cambridge' });
    expect(record).toMatchObject({ program_name: 'AI', university_id: record.university.id });
    expect(fake.tables.universities).toHaveLength(1);
    expect(fake.tables.applications).toHaveLength(1);
  });

  it('never sends who owns the row: the database decides that', async () => {
    const { api, fake } = setup();
    await api.create(input());
    expect(fake.tables.applications![0]).not.toHaveProperty('user_id');
    expect(fake.tables.universities![0]).not.toHaveProperty('user_id');
  });

  it('reuses a university you already have, whatever the capitals or spacing', async () => {
    const { api, fake } = setup(seeded());
    const record = await api.create(
      input({
        university: { name: '  stanford UNIVERSITY ' },
        application: { program_name: 'Statistics' },
      }),
    );
    expect(fake.tables.universities).toHaveLength(1);
    expect(record.university_id).toBe('uni-1');
    // The spelling you first used stays.
    expect(record.university.name).toBe('Stanford University');
  });

  it('sees extra spaces between words as the same university', async () => {
    const { api, fake } = setup(seeded());
    const record = await api.create(
      input({
        university: { name: 'Stanford \u00a0  University' },
        application: { program_name: 'Statistics' },
      }),
    );
    expect(fake.tables.universities).toHaveLength(1);
    expect(record.university_id).toBe('uni-1');
  });

  it('fills in blanks on a shared university but never erases what is there', async () => {
    const { api, fake } = setup({
      universities: [university({ city: 'Stanford', region: null, website_url: null })],
      applications: [application()],
    });
    await api.create(
      input({
        university: {
          name: 'Stanford University',
          city: null, // left empty this time: must not wipe "Stanford"
          region: 'CA', // was blank: filled in
          website_url: 'https://www.stanford.edu',
        },
        application: { program_name: 'Statistics' },
      }),
    );
    expect(fake.tables.universities![0]).toMatchObject({
      city: 'Stanford',
      region: 'CA',
      website_url: 'https://www.stanford.edu',
    });
  });

  it('corrects a shared university when a new value is entered', async () => {
    const { api, fake } = setup(seeded());
    await api.create(input({ university: { name: 'Stanford University', city: 'Palo Alto' } }));
    expect(fake.tables.universities![0]).toMatchObject({ city: 'Palo Alto' });
  });

  it('leaves the university alone when nothing about it changed', async () => {
    const { api, fake } = setup(seeded());
    await api.create(input({ university: { name: 'Stanford University', city: 'Stanford' } }));
    expect(fake.requests).not.toContain('update universities');
    expect(fake.requests).not.toContain('insert universities');
  });

  it('uses the university another tab just added instead of failing', async () => {
    const { api, fake } = setup();
    // We look and find no MIT; before we insert one, another tab adds it.
    fake.beforeNext('universities', 'insert', () => {
      fake.tables.universities!.push(university({ id: 'uni-raced', name: 'MIT', city: null }));
    });
    const record = await api.create(input({ university: { city: 'Cambridge' } }));
    expect(record.university_id).toBe('uni-raced');
    expect(fake.tables.universities).toHaveLength(1);
    // Details we entered still reach the shared record.
    expect(fake.tables.universities![0]).toMatchObject({ city: 'Cambridge' });
  });

  it('removes a university it just created if the program cannot be saved', async () => {
    const { api, fake } = setup();
    fake.failNext('applications', 'insert', { code: '23514', message: 'check violation' });
    await expect(api.create(input())).rejects.toMatchObject({ kind: 'invalid' });
    expect(fake.tables.universities).toHaveLength(0);
    expect(fake.tables.applications).toHaveLength(0);
  });

  it('does not remove a university that was already there', async () => {
    const { api, fake } = setup(seeded());
    fake.failNext('applications', 'insert', { code: '23514', message: 'check violation' });
    await expect(
      api.create(input({ university: { name: 'Stanford University' } })),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(universityNames(fake)).toEqual(['Stanford University']);
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup();
    fake.failNext('universities', 'insert', { code: '', message: 'TypeError: Failed to fetch' });
    await expect(api.create(input())).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('update', () => {
  it('saves the program without touching other programs', async () => {
    const { api, fake } = setup({
      universities: [university()],
      applications: [application(), application({ id: 'app-2', program_name: 'Statistics' })],
    });
    const record = await api.update(
      'app-1',
      input({
        university: { name: 'Stanford University', city: 'Stanford' },
        application: { program_name: 'Robotics', status: 'submitted' },
      }),
    );
    expect(record).toMatchObject({ id: 'app-1', program_name: 'Robotics', status: 'submitted' });
    expect(fake.tables.applications!.find((row) => row.id === 'app-2')).toMatchObject({
      program_name: 'Statistics',
    });
  });

  it('keeps your favorite star, which the form does not edit', async () => {
    const { api } = setup({
      universities: [university()],
      applications: [application({ is_favorite: true })],
    });
    const record = await api.update(
      'app-1',
      input({ university: { name: 'Stanford University' } }),
    );
    expect(record.is_favorite).toBe(true);
  });

  it('moves the program to another university and tidies up the empty one', async () => {
    const { api, fake } = setup(seeded());
    const record = await api.update('app-1', input({ university: { name: 'MIT' } }));
    expect(record.university.name).toBe('MIT');
    expect(universityNames(fake)).toEqual(['MIT']);
  });

  it('keeps the old university when other programs still use it', async () => {
    const { api, fake } = setup({
      universities: [university()],
      applications: [application(), application({ id: 'app-2', program_name: 'Statistics' })],
    });
    await api.update('app-1', input({ university: { name: 'MIT' } }));
    expect(universityNames(fake).sort()).toEqual(['MIT', 'Stanford University']);
  });

  it('joins an existing university when the name matches one you have', async () => {
    const { api, fake } = setup({
      universities: [university(), university({ id: 'uni-2', name: 'MIT' })],
      applications: [application(), application({ id: 'app-2', university_id: 'uni-2' })],
    });
    const record = await api.update('app-1', input({ university: { name: 'mit' } }));
    expect(record.university_id).toBe('uni-2');
    expect(universityNames(fake)).toEqual(['MIT']);
  });

  it('says the program is gone if it was deleted elsewhere, and leaves no stray university', async () => {
    const { api, fake } = setup();
    await expect(api.update('missing', input())).rejects.toMatchObject({ kind: 'not_found' });
    expect(fake.tables.universities).toHaveLength(0);
  });

  it('removes the new university if the change cannot be saved', async () => {
    const { api, fake } = setup(seeded());
    fake.failNext('applications', 'update', { code: '23514', message: 'check violation' });
    await expect(api.update('app-1', input({ university: { name: 'MIT' } }))).rejects.toMatchObject(
      {
        kind: 'invalid',
      },
    );
    expect(universityNames(fake)).toEqual(['Stanford University']);
  });
});

describe('setStatus', () => {
  it('changes only the status', async () => {
    const { api, fake } = setup(seeded());
    await api.setStatus('app-1', 'accepted');
    expect(fake.tables.applications![0]).toMatchObject({ status: 'accepted', submitted_on: null });
  });

  it('records the submission date along with it when given', async () => {
    const { api, fake } = setup(seeded());
    await api.setStatus('app-1', 'submitted', '2026-11-20');
    expect(fake.tables.applications![0]).toMatchObject({
      status: 'submitted',
      submitted_on: '2026-11-20',
    });
  });

  it('fails clearly if the program no longer exists', async () => {
    const { api } = setup();
    await expect(api.setStatus('missing', 'accepted')).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('setFavorite', () => {
  it('stars and unstars', async () => {
    const { api, fake } = setup(seeded());
    await api.setFavorite('app-1', true);
    expect(fake.tables.applications![0]).toMatchObject({ is_favorite: true });
    await api.setFavorite('app-1', false);
    expect(fake.tables.applications![0]).toMatchObject({ is_favorite: false });
  });

  it('fails clearly if the program no longer exists', async () => {
    const { api } = setup();
    await expect(api.setFavorite('missing', true)).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('remove', () => {
  it('deletes the program and the university nobody else uses', async () => {
    const { api, fake } = setup(seeded());
    await api.remove('app-1');
    expect(fake.tables.applications).toHaveLength(0);
    expect(fake.tables.universities).toHaveLength(0);
  });

  it('keeps a university that other programs use', async () => {
    const { api, fake } = setup({
      universities: [university()],
      applications: [application(), application({ id: 'app-2', program_name: 'Statistics' })],
    });
    await api.remove('app-1');
    expect(fake.tables.applications!.map((row) => row.id)).toEqual(['app-2']);
    expect(universityNames(fake)).toEqual(['Stanford University']);
  });

  it('counts an already-deleted program as done', async () => {
    const { api } = setup();
    await expect(api.remove('missing')).resolves.toBeUndefined();
  });

  it('still succeeds if the tidy-up of the university fails', async () => {
    const { api, fake } = setup(seeded());
    fake.failNext('universities', 'delete', { code: '23503', message: 'in use' });
    await expect(api.remove('app-1')).resolves.toBeUndefined();
    expect(fake.tables.applications).toHaveLength(0);
  });

  it('reports a refusal to delete', async () => {
    const { api, fake } = setup(seeded());
    fake.failNext('applications', 'delete', { code: '42501', message: 'permission denied' });
    await expect(api.remove('app-1')).rejects.toMatchObject({ kind: 'permission' });
    expect(fake.tables.applications).toHaveLength(1);
  });
});
