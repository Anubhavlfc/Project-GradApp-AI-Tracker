import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createRequirementsApi } from './api';
import type { RequirementFields } from './types';

const application = (id = 'app-1') => ({
  id,
  university_id: 'uni-1',
  program_name: 'Computer Science',
});

const requirementRow = (overrides = {}) => ({
  id: 'req-1',
  application_id: 'app-1',
  kind: 'transcript',
  label: null,
  is_required: true,
  status: 'not_started',
  due_date: null,
  document_id: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const fields = (overrides: Partial<RequirementFields> = {}): RequirementFields => ({
  kind: 'resume_cv',
  label: null,
  is_required: true,
  status: 'not_started',
  due_date: null,
  notes: null,
  ...overrides,
});

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({ applications: [application()], ...seed });
  return { fake, api: createRequirementsApi(fake.client) };
}

describe('list', () => {
  it('returns every item in one request', async () => {
    const { api, fake } = setup({
      requirements: [requirementRow(), requirementRow({ id: 'req-2', kind: 'gre' })],
    });
    const rows = await api.list();
    expect(rows.map((row) => row.id)).toEqual(['req-1', 'req-2']);
    expect(fake.requests).toEqual(['select requirements']);
  });

  it('refuses data that does not look like a checklist item, rather than showing nonsense', async () => {
    const { api } = setup({ requirements: [requirementRow({ status: 'on_fire' })] });
    await expect(api.list()).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup();
    fake.failNext('requirements', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});

describe('add', () => {
  it('adds several items to one program in a single request', async () => {
    const { api, fake } = setup();
    const created = await api.add('app-1', [
      fields({ kind: 'transcript' }),
      fields({ kind: 'recommendation_letter', label: 'Recommendation Letter 1' }),
      fields({ kind: 'gre', is_required: false }),
    ]);
    expect(created.map((row) => row.kind)).toEqual(['transcript', 'recommendation_letter', 'gre']);
    expect(created.every((row) => row.application_id === 'app-1')).toBe(true);
    expect(fake.tables.requirements).toHaveLength(3);
    expect(fake.requests).toEqual(['insert requirements']);
  });

  it('never sends who owns the row: the database decides that', async () => {
    const { api, fake } = setup();
    await api.add('app-1', [fields()]);
    expect(fake.tables.requirements![0]).not.toHaveProperty('user_id');
  });

  it('does nothing, and asks nothing, for an empty list', async () => {
    const { api, fake } = setup();
    expect(await api.add('app-1', [])).toEqual([]);
    expect(fake.requests).toEqual([]);
  });

  it('adds all of the items or none of them', async () => {
    const { api, fake } = setup();
    const error = await api.add('app-gone', [fields(), fields({ kind: 'gre' })]).catch((e) => e);
    expect(error).toMatchObject({ name: 'DataError', kind: 'conflict' });
    expect(fake.tables.requirements).toHaveLength(0);
  });

  it('keeps what was typed, exactly', async () => {
    const { api } = setup();
    const [row] = await api.add('app-1', [
      fields({
        kind: 'supplemental_essay',
        label: 'Why Stanford',
        is_required: false,
        status: 'in_progress',
        due_date: '2026-12-01',
        notes: 'Draft 2',
      }),
    ]);
    expect(row).toMatchObject({
      kind: 'supplemental_essay',
      label: 'Why Stanford',
      is_required: false,
      status: 'in_progress',
      due_date: '2026-12-01',
      notes: 'Draft 2',
    });
  });
});

describe('update', () => {
  it('saves the changes and returns the item as stored', async () => {
    const { api, fake } = setup({ requirements: [requirementRow()] });
    const row = await api.update(
      'req-1',
      fields({ kind: 'transcript', status: 'complete', notes: 'Sent by post' }),
    );
    expect(row).toMatchObject({ id: 'req-1', status: 'complete', notes: 'Sent by post' });
    expect(fake.tables.requirements![0]).toMatchObject({ status: 'complete' });
  });

  it('says so when the item is gone, for example deleted in another tab', async () => {
    const { api } = setup();
    await expect(api.update('req-9', fields())).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('turns a rejected value into a message about the values', async () => {
    const { api, fake } = setup({ requirements: [requirementRow()] });
    fake.failNext('requirements', 'update', { code: '23514', message: 'check constraint' });
    await expect(api.update('req-1', fields())).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('setStatus', () => {
  it('changes only the status', async () => {
    const { api, fake } = setup({ requirements: [requirementRow({ notes: 'keep me' })] });
    await api.setStatus('req-1', 'submitted');
    expect(fake.tables.requirements![0]).toMatchObject({ status: 'submitted', notes: 'keep me' });
  });

  it('says so when the item is gone', async () => {
    const { api } = setup();
    await expect(api.setStatus('req-9', 'complete')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup({ requirements: [requirementRow()] });
    fake.failNext('requirements', 'update', { code: '', message: 'TypeError: Failed to fetch' });
    await expect(api.setStatus('req-1', 'complete')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('setDocument', () => {
  const doc = (id: string) => ({ id, name: `Document ${id}`, kind: 'resume' });

  it('chooses the document and changes nothing else', async () => {
    const { api, fake } = setup({
      requirements: [requirementRow({ notes: 'keep me', status: 'in_progress' })],
      documents: [doc('doc-1')],
    });
    await api.setDocument('req-1', 'doc-1');
    expect(fake.tables.requirements![0]).toMatchObject({
      document_id: 'doc-1',
      notes: 'keep me',
      status: 'in_progress',
    });
  });

  it('clears the choice with null', async () => {
    const { api, fake } = setup({
      requirements: [requirementRow({ document_id: 'doc-1' })],
      documents: [doc('doc-1')],
    });
    await api.setDocument('req-1', null);
    expect(fake.tables.requirements![0]).toMatchObject({ document_id: null });
  });

  it('refuses a document that is not there, for example deleted in another tab', async () => {
    const { api, fake } = setup({ requirements: [requirementRow()] });
    await expect(api.setDocument('req-1', 'doc-9')).rejects.toMatchObject({
      kind: 'conflict',
      cause: expect.objectContaining({ code: '23503' }),
    });
    expect(fake.tables.requirements![0]).toMatchObject({ document_id: null });
  });

  it('says so when the item is gone', async () => {
    const { api } = setup({ documents: [doc('doc-1')] });
    await expect(api.setDocument('req-9', 'doc-1')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup({ requirements: [requirementRow()], documents: [doc('doc-1')] });
    fake.failNext('requirements', 'update', { code: '', message: 'TypeError: Failed to fetch' });
    await expect(api.setDocument('req-1', 'doc-1')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('remove', () => {
  it('deletes the item', async () => {
    const { api, fake } = setup({
      requirements: [requirementRow(), requirementRow({ id: 'req-2', kind: 'gre' })],
    });
    await api.remove('req-1');
    expect(fake.tables.requirements!.map((row) => row.id)).toEqual(['req-2']);
  });

  it('counts an item that is already gone as deleted', async () => {
    const { api } = setup();
    await expect(api.remove('req-9')).resolves.toBeUndefined();
  });

  it('reports a failure', async () => {
    const { api, fake } = setup({ requirements: [requirementRow()] });
    fake.failNext('requirements', 'delete', { code: '42501', message: 'permission denied' });
    await expect(api.remove('req-1')).rejects.toMatchObject({ kind: 'permission' });
  });
});

describe('when a program is deleted', () => {
  it('its checklist goes with it (the fake mirrors the database cascade)', async () => {
    const { fake } = setup({ requirements: [requirementRow()] });
    await fake.client.from('applications').delete().eq('id', 'app-1');
    expect(fake.tables.requirements).toHaveLength(0);
  });
});
