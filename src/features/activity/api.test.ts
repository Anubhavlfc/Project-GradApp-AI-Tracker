import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createActivityApi } from './api';

const entry = (overrides = {}) => ({
  id: 'activity-1',
  user_id: 'user-1',
  application_id: null,
  kind: 'task_completed',
  subject: 'Email Prof. Lee',
  detail: null,
  meta: { program: null },
  created_at: '2026-09-01T12:00:00+00:00',
  ...overrides,
});

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({ activity: [entry()], ...seed });
  return { fake, api: createActivityApi(fake.client) };
}

describe('recent', () => {
  it('returns the entries in one request, and only the columns the screen needs', async () => {
    const { api, fake } = setup({ activity: [entry(), entry({ id: 'activity-2' })] });
    const rows = await api.recent(10);
    expect(rows.map((row) => row.id)).toEqual(['activity-1', 'activity-2']);
    expect(rows[0]).not.toHaveProperty('user_id');
    expect(fake.requests).toEqual(['select activity']);
  });

  it('asks for the newest first, with a steady order among entries made at the same moment', async () => {
    const { api, fake } = setup();
    await api.recent(10);
    expect(fake.orders).toEqual(['activity created_at desc', 'activity id desc']);
  });

  it('asks for no more than the limit', async () => {
    const entries = Array.from({ length: 5 }, (_, index) => entry({ id: `activity-${index}` }));
    const { api } = setup({ activity: entries });
    expect(await api.recent(3)).toHaveLength(3);
    expect(await api.recent(50)).toHaveLength(5);
  });

  it('accepts a kind it has not heard of, so a newer database cannot break the dashboard', async () => {
    const { api } = setup({ activity: [entry({ kind: 'something_new' })] });
    expect(await api.recent(10)).toMatchObject([{ kind: 'something_new' }]);
  });

  it('refuses data that does not look like an entry, rather than showing nonsense', async () => {
    const { api } = setup({ activity: [entry({ meta: 'not an object' })] });
    await expect(api.recent(10)).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup();
    fake.failNext('activity', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.recent(10).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});
