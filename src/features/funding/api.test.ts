import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createFundingApi } from './api';
import type { FundingFields } from './types';

const application = (id = 'app-1') => ({
  id,
  university_id: 'uni-1',
  program_name: 'Computer Science',
});

const fundingRow = (overrides = {}) => ({
  id: 'fund-1',
  application_id: 'app-1',
  name: 'Departmental fellowship',
  kind: 'fellowship',
  amount: 20000,
  currency: 'USD',
  deadline: '2026-12-01',
  application_required: true,
  status: 'researching',
  url: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const fields = (overrides: Partial<FundingFields> = {}): FundingFields => ({
  application_id: 'app-1',
  name: 'Departmental fellowship',
  kind: 'fellowship',
  amount: null,
  currency: 'USD',
  deadline: null,
  application_required: false,
  status: 'researching',
  url: null,
  notes: null,
  ...overrides,
});

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({
    applications: [application(), application('app-2')],
    funding: [fundingRow()],
    ...seed,
  });
  return { fake, api: createFundingApi(fake.client) };
}

describe('list', () => {
  it('returns every item, tied to a program or not, in one request', async () => {
    const { api, fake } = setup({
      funding: [fundingRow(), fundingRow({ id: 'fund-2', application_id: null })],
    });
    const rows = await api.list();
    expect(rows.map((row) => row.id)).toEqual(['fund-1', 'fund-2']);
    expect(rows[1]?.application_id).toBeNull();
    expect(fake.requests).toEqual(['select funding']);
  });

  it('refuses data that does not look like funding, rather than showing nonsense', async () => {
    const { api } = setup({ funding: [fundingRow({ status: 'lottery' })] });
    await expect(api.list()).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup();
    fake.failNext('funding', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});

describe('create', () => {
  it('saves the item and returns it as stored', async () => {
    const { api, fake } = setup({ funding: [] });
    const row = await api.create(
      fields({
        name: 'Knight-Hennessy',
        amount: 90000,
        deadline: '2026-10-08',
        url: 'https://kh.edu',
      }),
    );
    expect(row).toMatchObject({
      application_id: 'app-1',
      name: 'Knight-Hennessy',
      amount: 90000,
      deadline: '2026-10-08',
      url: 'https://kh.edu',
    });
    expect(fake.tables.funding).toHaveLength(1);
  });

  it('never sends who owns the row: the database decides that', async () => {
    const { api, fake } = setup({ funding: [] });
    await api.create(fields());
    expect(fake.tables.funding[0]).not.toHaveProperty('user_id');
  });

  it('allows funding that is tied to no program', async () => {
    const { api } = setup({ funding: [] });
    await expect(api.create(fields({ application_id: null }))).resolves.toMatchObject({
      application_id: null,
    });
  });

  it('refuses a program that is not there', async () => {
    const { api, fake } = setup({ funding: [] });
    await expect(api.create(fields({ application_id: 'app-9' }))).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(fake.tables.funding).toHaveLength(0);
  });

  it('turns a rejected value into a message about the values', async () => {
    const { api, fake } = setup();
    fake.failNext('funding', 'insert', { code: '23514', message: 'check constraint' });
    await expect(api.create(fields())).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('update', () => {
  it('saves the changes and returns the item as stored', async () => {
    const { api, fake } = setup();
    const row = await api.update(
      'fund-1',
      fields({ name: 'Renamed', amount: 500, status: 'applied' }),
    );
    expect(row).toMatchObject({ id: 'fund-1', name: 'Renamed', amount: 500, status: 'applied' });
    expect(fake.tables.funding[0]).toMatchObject({ name: 'Renamed' });
  });

  it('can move an item to another program, or to none', async () => {
    const { api } = setup();
    await expect(api.update('fund-1', fields({ application_id: 'app-2' }))).resolves.toMatchObject({
      application_id: 'app-2',
    });
    await expect(api.update('fund-1', fields({ application_id: null }))).resolves.toMatchObject({
      application_id: null,
    });
  });

  it('refuses to move an item to a program that is not there', async () => {
    const { api, fake } = setup();
    await expect(api.update('fund-1', fields({ application_id: 'app-9' }))).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(fake.tables.funding[0]).toMatchObject({ application_id: 'app-1' });
  });

  it('says so when the item is gone, for example deleted in another tab', async () => {
    const { api } = setup();
    await expect(api.update('fund-9', fields())).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('setStatus', () => {
  it('changes only the status', async () => {
    const { api, fake } = setup({ funding: [fundingRow({ notes: 'keep me', amount: 20000 })] });
    await api.setStatus('fund-1', 'offered');
    expect(fake.tables.funding[0]).toMatchObject({
      status: 'offered',
      notes: 'keep me',
      amount: 20000,
    });
  });

  it('says so when the item is gone', async () => {
    const { api } = setup();
    await expect(api.setStatus('fund-9', 'offered')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup();
    fake.failNext('funding', 'update', { code: '', message: 'TypeError: Failed to fetch' });
    await expect(api.setStatus('fund-1', 'offered')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('remove', () => {
  it('deletes the item and nothing else', async () => {
    const { api, fake } = setup({
      funding: [fundingRow(), fundingRow({ id: 'fund-2' })],
    });
    await api.remove('fund-1');
    expect(fake.tables.funding.map((row) => row.id)).toEqual(['fund-2']);
    expect(fake.tables.applications).toHaveLength(2);
  });

  it('counts an item that is already gone as deleted', async () => {
    const { api } = setup();
    await expect(api.remove('fund-9')).resolves.toBeUndefined();
  });

  it('reports a failure', async () => {
    const { api, fake } = setup();
    fake.failNext('funding', 'delete', { code: '42501', message: 'permission denied' });
    await expect(api.remove('fund-1')).rejects.toMatchObject({ kind: 'permission' });
  });
});

describe('when a program is deleted', () => {
  it('its funding goes with it, and funding tied to no program stays', async () => {
    const { fake } = setup({
      funding: [
        fundingRow(),
        fundingRow({ id: 'fund-2', application_id: 'app-2' }),
        fundingRow({ id: 'fund-3', application_id: null }),
      ],
    });
    await fake.client.from('applications').delete().eq('id', 'app-1');
    expect(fake.tables.funding.map((row) => row.id)).toEqual(['fund-2', 'fund-3']);
  });
});
