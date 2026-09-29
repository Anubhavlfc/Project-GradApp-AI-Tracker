import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createSettingsApi, EXPORT_TABLES, PAGE_SIZE } from './api';

const rows = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${String(index).padStart(5, '0')}`,
    name: `${prefix} ${index}`,
  }));

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase(seed);
  return { fake, api: createSettingsApi(fake.client) };
}

describe('exportData', () => {
  it('reads every table the app keeps, and nothing else', async () => {
    const { api, fake } = setup();
    const data = await api.exportData();
    expect(Object.keys(data).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(new Set(fake.requests)).toEqual(new Set(EXPORT_TABLES.map((t) => `select ${t}`)));
  });

  it('includes the profile, the checklists, the letters and the activity log', () => {
    // The export is a promise about what the person owns; a table missing from it is a broken promise.
    expect(EXPORT_TABLES).toEqual(
      expect.arrayContaining([
        'profiles',
        'universities',
        'applications',
        'documents',
        'requirements',
        'recommenders',
        'recommendation_requests',
        'funding',
        'tasks',
        'activity',
      ]),
    );
    expect(EXPORT_TABLES).toHaveLength(10);
  });

  it('returns the rows as they are stored', async () => {
    const { api } = setup({
      tasks: [{ id: 't1', title: 'Email Prof. Lee', status: 'todo', user_id: 'user-1' }],
      profiles: [{ id: 'user-1', display_name: 'Ada' }],
    });
    const data = await api.exportData();
    expect(data.tasks).toEqual([
      { id: 't1', title: 'Email Prof. Lee', status: 'todo', user_id: 'user-1' },
    ]);
    expect(data.profiles).toEqual([{ id: 'user-1', display_name: 'Ada' }]);
    expect(data.funding).toEqual([]);
  });

  it('reads a long table page by page, so nothing is cut off at the server limit', async () => {
    const total = PAGE_SIZE * 2 + 5;
    const { api, fake } = setup({ tasks: rows(total, 'task') });
    const data = await api.exportData();
    expect(data.tasks).toHaveLength(total);
    expect(new Set(data.tasks.map((row) => row.id)).size).toBe(total);
    expect(fake.requests.filter((request) => request === 'select tasks')).toHaveLength(3);
  });

  it('asks for one more page when a table ends exactly on a page boundary', async () => {
    const { api, fake } = setup({ tasks: rows(PAGE_SIZE, 'task') });
    const data = await api.exportData();
    expect(data.tasks).toHaveLength(PAGE_SIZE);
    // The second request is how it learns there is nothing more.
    expect(fake.requests.filter((request) => request === 'select tasks')).toHaveLength(2);
  });

  it('orders by time and then id, so pages neither overlap nor skip rows', async () => {
    const { api, fake } = setup();
    await api.exportData();
    expect(fake.orders).toEqual(
      expect.arrayContaining(['tasks created_at asc', 'tasks id asc', 'activity id asc']),
    );
  });

  it('fails as a whole, with a message fit for the screen, rather than giving half a file', async () => {
    const { api, fake } = setup();
    fake.failNext('funding', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.exportData().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});

describe('deleteAccount', () => {
  it('calls the database function that deletes the signed-in person, with no argument', async () => {
    const { api, fake } = setup();
    const calls: unknown[] = [];
    fake.onRpc('delete_my_account', (args) => {
      calls.push(args);
      return { data: null, error: null };
    });
    await api.deleteAccount();
    expect(fake.requests).toEqual(['rpc delete_my_account']);
    // Nobody's id is sent: the database uses whoever is signed in, so it cannot be aimed elsewhere.
    expect(calls).toEqual([undefined]);
  });

  it('does not pretend it worked when the database says no', async () => {
    const { api, fake } = setup();
    fake.onRpc('delete_my_account', () => ({
      data: null,
      error: { code: '42501', message: 'permission denied for function delete_my_account' },
    }));
    const error = await api.deleteAccount().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'permission' });
  });

  it('reports an expired session as one', async () => {
    const { api, fake } = setup();
    fake.onRpc('delete_my_account', () => ({
      data: null,
      error: { code: 'PGRST301', message: 'JWT expired' },
    }));
    await expect(api.deleteAccount()).rejects.toMatchObject({ kind: 'session' });
  });

  it('reports a missing function (the migration was never applied) as a general failure', async () => {
    const { api } = setup();
    await expect(api.deleteAccount()).rejects.toMatchObject({ kind: 'unknown' });
  });
});
