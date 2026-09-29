import { DataError } from '@/lib/dataError';
import { createFakeSupabase } from '@/test/fakeSupabaseData';
import { createTasksApi } from './api';
import type { TaskFields } from './types';

const taskRow = (overrides = {}) => ({
  id: 'task-1',
  application_id: null,
  title: 'Email Prof. Lee',
  due_date: null,
  priority: 'medium',
  status: 'todo',
  completed_at: null,
  notes: null,
  created_at: '2026-09-01T00:00:00+00:00',
  updated_at: '2026-09-01T00:00:00+00:00',
  ...overrides,
});

const fields = (overrides: Partial<TaskFields> = {}): TaskFields => ({
  application_id: null,
  title: 'Email Prof. Lee',
  due_date: null,
  priority: 'medium',
  status: 'todo',
  notes: null,
  ...overrides,
});

const program = { id: 'app-1', university_id: 'uni-1', program_name: 'CS' };

function setup(seed: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({ tasks: [taskRow()], ...seed });
  return { fake, api: createTasksApi(fake.client) };
}

describe('list', () => {
  it('returns every task in one request', async () => {
    const { api, fake } = setup({ tasks: [taskRow(), taskRow({ id: 'task-2', title: 'B' })] });
    const rows = await api.list();
    expect(rows.map((row) => row.id)).toEqual(['task-1', 'task-2']);
    expect(fake.requests).toEqual(['select tasks']);
  });

  it('refuses data that does not look like a task, rather than showing nonsense', async () => {
    const { api } = setup({ tasks: [taskRow({ priority: 'urgent' })] });
    await expect(api.list()).rejects.toMatchObject({ name: 'DataError', kind: 'unknown' });
  });

  it('turns a database failure into a message fit for the screen', async () => {
    const { api, fake } = setup();
    fake.failNext('tasks', 'select', { code: 'PGRST301', message: 'JWT expired' });
    const error = await api.list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ kind: 'session' });
  });
});

describe('create', () => {
  it('saves the task and returns it as stored', async () => {
    const { api, fake } = setup({ tasks: [], applications: [program] });
    const row = await api.create(
      fields({ title: 'Order transcripts', application_id: 'app-1', priority: 'high' }),
    );
    expect(row).toMatchObject({
      title: 'Order transcripts',
      application_id: 'app-1',
      priority: 'high',
      status: 'todo',
    });
    expect(fake.tables.tasks).toHaveLength(1);
  });

  it('never sends who owns the row: the database decides that', async () => {
    const { api, fake } = setup({ tasks: [] });
    await api.create(fields());
    expect(fake.tables.tasks[0]).not.toHaveProperty('user_id');
  });

  it('turns a rejected value into a message about the values', async () => {
    const { api, fake } = setup();
    fake.failNext('tasks', 'insert', { code: '23514', message: 'check constraint' });
    await expect(api.create(fields())).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('refuses a program that does not exist', async () => {
    const { api } = setup({ tasks: [] });
    await expect(api.create(fields({ application_id: 'app-9' }))).rejects.toMatchObject({
      name: 'DataError',
    });
  });
});

describe('update', () => {
  it('saves the changes and returns the task as stored', async () => {
    const { api, fake } = setup();
    const row = await api.update(
      'task-1',
      fields({ title: 'Email Prof. Lee again', status: 'in_progress', due_date: '2026-12-01' }),
    );
    expect(row).toMatchObject({
      id: 'task-1',
      title: 'Email Prof. Lee again',
      status: 'in_progress',
      due_date: '2026-12-01',
    });
    expect(fake.tables.tasks[0]).toMatchObject({ title: 'Email Prof. Lee again' });
  });

  it('says so when the task is gone, for example deleted in another tab', async () => {
    const { api } = setup();
    await expect(api.update('task-9', fields())).rejects.toMatchObject({ kind: 'not_found' });
  });
});

describe('setStatus', () => {
  it('changes only the status', async () => {
    const { api, fake } = setup({ tasks: [taskRow({ notes: 'keep me', priority: 'high' })] });
    await api.setStatus('task-1', 'complete');
    expect(fake.tables.tasks[0]).toMatchObject({
      status: 'complete',
      notes: 'keep me',
      priority: 'high',
      title: 'Email Prof. Lee',
    });
  });

  it('says so when the task is gone', async () => {
    const { api } = setup();
    await expect(api.setStatus('task-9', 'complete')).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  it('reports a lost connection as such', async () => {
    const { api, fake } = setup();
    fake.failNext('tasks', 'update', { code: '', message: 'TypeError: Failed to fetch' });
    await expect(api.setStatus('task-1', 'complete')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('remove', () => {
  it('deletes the task and nothing else', async () => {
    const { api, fake } = setup({ tasks: [taskRow(), taskRow({ id: 'task-2' })] });
    await api.remove('task-1');
    expect(fake.tables.tasks.map((row) => row.id)).toEqual(['task-2']);
  });

  it('counts a task that is already gone as deleted', async () => {
    const { api } = setup();
    await expect(api.remove('task-9')).resolves.toBeUndefined();
  });

  it('reports a failure', async () => {
    const { api, fake } = setup();
    fake.failNext('tasks', 'delete', { code: '42501', message: 'permission denied' });
    await expect(api.remove('task-1')).rejects.toMatchObject({ kind: 'permission' });
  });
});

describe('when a program is deleted', () => {
  it('takes its tasks with it and keeps the ones tied to none', async () => {
    const fake = createFakeSupabase({
      universities: [{ id: 'uni-1', name: 'MIT' }],
      applications: [program],
      tasks: [
        taskRow({ id: 'mine', application_id: 'app-1' }),
        taskRow({ id: 'free', application_id: null }),
      ],
    });
    await fake.client.from('applications').delete().eq('id', 'app-1');
    expect(fake.tables.tasks.map((row) => row.id)).toEqual(['free']);
  });
});
