import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createDocumentsApi } from './api';
import type { DocumentFields } from './types';

const documentRow = (overrides = {}) => ({
  id: 'doc-1',
  name: 'Resume, 2026',
  kind: 'resume',
  status: 'not_started',
  url: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const fields = (overrides: Partial<DocumentFields> = {}): DocumentFields => ({
  name: 'Resume, 2026',
  kind: 'resume',
  status: 'not_started',
  url: null,
  notes: null,
  ...overrides,
});

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({ documents: [documentRow()], ...seed });
  return { fake, api: createDocumentsApi(fake.client) };
}

describe('list', () => {
  it('returns every document in one request', async () => {
    const { api, fake } = setup({
      documents: [documentRow(), documentRow({ id: 'doc-2', name: 'CV', kind: 'cv' })],
    });
    const rows = await api.list();
    expect(rows.map((row) => row.id)).toEqual(['doc-1', 'doc-2']);
    expect(fake.requests).toEqual(['select documents']);
  });

  it('refuses data that does not look like a document, rather than showing nonsense', async () => {
    const { api } = setup({ documents: [documentRow({ kind: 'hologram' })] });
    await expect(api.list()).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup();
    fake.failNext('documents', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});

describe('create', () => {
  it('saves the document and returns it as stored', async () => {
    const { api, fake } = setup({ documents: [] });
    const row = await api.create(
      fields({ name: 'Portfolio', kind: 'portfolio', url: 'https://example.com/work' }),
    );
    expect(row).toMatchObject({
      name: 'Portfolio',
      kind: 'portfolio',
      status: 'not_started',
      url: 'https://example.com/work',
    });
    expect(fake.tables.documents).toHaveLength(1);
  });

  it('never sends who owns the row: the database decides that', async () => {
    const { api, fake } = setup({ documents: [] });
    await api.create(fields());
    expect(fake.tables.documents[0]).not.toHaveProperty('user_id');
  });

  it('turns a rejected value into a message about the values', async () => {
    const { api, fake } = setup();
    fake.failNext('documents', 'insert', { code: '23514', message: 'check constraint' });
    await expect(api.create(fields())).rejects.toMatchObject({ kind: 'invalid' });
  });
});

describe('createMany', () => {
  it('adds all of them in a single request', async () => {
    const { api, fake } = setup({ documents: [] });
    const rows = await api.createMany([
      fields({ name: 'Resume' }),
      fields({ name: 'Transcript', kind: 'transcript' }),
      fields({ name: 'Statement of Purpose', kind: 'statement_of_purpose' }),
    ]);
    expect(rows.map((row) => row.name)).toEqual(['Resume', 'Transcript', 'Statement of Purpose']);
    expect(fake.tables.documents).toHaveLength(3);
    expect(fake.requests).toEqual(['insert documents']);
  });

  it('adds all of them or none', async () => {
    const { api, fake } = setup({ documents: [] });
    fake.failNext('documents', 'insert', { code: '23514', message: 'check constraint' });
    await expect(
      api.createMany([fields(), fields({ name: 'CV', kind: 'cv' })]),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(fake.tables.documents).toHaveLength(0);
  });

  it('asks nothing of the server when there is nothing to add', async () => {
    const { api, fake } = setup({ documents: [] });
    await expect(api.createMany([])).resolves.toEqual([]);
    expect(fake.requests).toEqual([]);
  });
});

describe('update', () => {
  it('saves the changes and returns the document as stored', async () => {
    const { api, fake } = setup();
    const row = await api.update(
      'doc-1',
      fields({ name: 'Resume, final', status: 'complete', url: 'https://example.com/cv.pdf' }),
    );
    expect(row).toMatchObject({
      id: 'doc-1',
      name: 'Resume, final',
      status: 'complete',
      url: 'https://example.com/cv.pdf',
    });
    expect(fake.tables.documents[0]).toMatchObject({ name: 'Resume, final' });
  });

  it('says so when the document is gone, for example deleted in another tab', async () => {
    const { api } = setup();
    await expect(api.update('doc-9', fields())).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('setStatus', () => {
  it('changes only the status', async () => {
    const { api, fake } = setup({ documents: [documentRow({ notes: 'keep me' })] });
    await api.setStatus('doc-1', 'complete');
    expect(fake.tables.documents[0]).toMatchObject({
      status: 'complete',
      notes: 'keep me',
      name: 'Resume, 2026',
    });
  });

  it('says so when the document is gone', async () => {
    const { api } = setup();
    await expect(api.setStatus('doc-9', 'complete')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup();
    fake.failNext('documents', 'update', { code: '', message: 'TypeError: Failed to fetch' });
    await expect(api.setStatus('doc-1', 'complete')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('remove', () => {
  it('deletes the document and nothing else', async () => {
    const { api, fake } = setup({
      documents: [documentRow(), documentRow({ id: 'doc-2' })],
    });
    await api.remove('doc-1');
    expect(fake.tables.documents.map((row) => row.id)).toEqual(['doc-2']);
  });

  it('keeps the checklist items that used it, without a document', async () => {
    const { api, fake } = setup({
      applications: [{ id: 'app-1', university_id: 'uni-1', program_name: 'CS' }],
      requirements: [
        { id: 'req-1', application_id: 'app-1', kind: 'resume_cv', document_id: 'doc-1' },
        { id: 'req-2', application_id: 'app-1', kind: 'transcript', document_id: 'doc-2' },
      ],
      documents: [documentRow(), documentRow({ id: 'doc-2' })],
    });
    await api.remove('doc-1');
    expect(fake.tables.requirements).toHaveLength(2);
    expect(fake.tables.requirements.map((row) => row.document_id)).toEqual([null, 'doc-2']);
  });

  it('counts a document that is already gone as deleted', async () => {
    const { api } = setup();
    await expect(api.remove('doc-9')).resolves.toBeUndefined();
  });

  it('reports a failure', async () => {
    const { api, fake } = setup();
    fake.failNext('documents', 'delete', { code: '42501', message: 'permission denied' });
    await expect(api.remove('doc-1')).rejects.toMatchObject({ kind: 'permission' });
  });
});
