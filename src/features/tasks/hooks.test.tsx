import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/useAuth';
import { DataError } from '@/lib/dataError';
import { createQueryClient } from '@/lib/queryClient';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeTasksApi, fakeTask } from '@/test/fakeTasksApi';
import { TasksApiContext } from './api-context';
import {
  taskErrorMessage,
  useApplicationTasks,
  useDeleteTask,
  useSaveTask,
  useSortedTasks,
  useTaskActions,
} from './hooks';
import type { TaskFields, TaskRow } from './types';

const KEY = ['tasks', 'user-1'];

type Fake = ReturnType<typeof createFakeTasksApi>;

/** The hooks for someone who is signed in, with the list already in the cache unless `cached` is false. */
async function setup<T>(
  useHook: () => T,
  seed: TaskRow[] = [],
  { cached = true, before }: { cached?: boolean; before?: (fake: Fake) => void } = {},
) {
  const fake = createFakeTasksApi(seed);
  before?.(fake);
  const queryClient = createQueryClient({ retry: false });
  if (cached) queryClient.setQueryData(KEY, structuredClone(seed));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider client={createFakeAuth(fakeSession()).client}>
      <TasksApiContext value={fake.api}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </TasksApiContext>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.state.status).toBe('signed_in'));
  return { fake, queryClient, ...hook };
}

const cachedRows = (queryClient: ReturnType<typeof createQueryClient>) =>
  queryClient.getQueryData<TaskRow[]>(KEY);

const fields = (overrides: Partial<TaskFields> = {}): TaskFields => ({
  application_id: null,
  title: 'Email the professor',
  due_date: null,
  priority: 'medium',
  status: 'todo',
  notes: null,
  ...overrides,
});

describe('useTaskActions', () => {
  it('sends a status change once', async () => {
    const row = fakeTask({ status: 'todo' });
    const { fake, result } = await setup(useTaskActions, [row]);
    result.current.value.setStatus(row, 'in_progress');
    await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setStatus).toHaveBeenCalledWith(row.id, 'in_progress');
  });

  it('sends nothing for the status the task already has', async () => {
    const row = fakeTask({ status: 'in_progress' });
    const { fake, result } = await setup(useTaskActions, [row]);
    result.current.value.setStatus(row, 'in_progress');
    await waitFor(() => expect(result.current.value.error).toBeNull());
    expect(fake.api.setStatus).not.toHaveBeenCalled();
  });

  it('judges a change by the task as it is now, not by the row the click came from', async () => {
    // The page still shows "To Do", but a change to In Progress has already gone through.
    const shown = fakeTask({ status: 'todo' });
    const { fake, result } = await setup(useTaskActions, [{ ...shown, status: 'in_progress' }]);
    result.current.value.setStatus(shown, 'in_progress');
    expect(fake.api.setStatus).not.toHaveBeenCalled();
    result.current.value.setStatus(shown, 'todo');
    await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setStatus).toHaveBeenCalledWith(shown.id, 'todo');
  });

  it('shows the new status at once', async () => {
    const row = fakeTask({ status: 'todo' });
    const { fake, result, queryClient } = await setup(useTaskActions, [row]);
    fake.api.setStatus.mockImplementationOnce(() => new Promise(() => {}));
    act(() => result.current.value.setStatus(row, 'in_progress'));
    await waitFor(() => expect(cachedRows(queryClient)?.[0]?.status).toBe('in_progress'));
    expect(fake.api.setStatus).toHaveBeenCalledTimes(1);
  });

  it('notes when a task was finished, straight away, and clears it when it is reopened', async () => {
    const row = fakeTask({ status: 'todo' });
    const { fake, result, queryClient } = await setup(useTaskActions, [row]);
    fake.api.setStatus.mockImplementation(() => new Promise(() => {}));

    act(() => result.current.value.setStatus(row, 'complete'));
    await waitFor(() => expect(cachedRows(queryClient)?.[0]?.status).toBe('complete'));
    // The same stamp the database will make, so the task sorts with the finished ones at once.
    const stamp = cachedRows(queryClient)?.[0]?.completed_at;
    expect(stamp).toEqual(expect.any(String));
    expect(Math.abs(Date.now() - new Date(stamp as string).getTime())).toBeLessThan(5000);

    const finished = cachedRows(queryClient)![0]!;
    act(() => result.current.value.setStatus(finished, 'todo'));
    await waitFor(() => expect(cachedRows(queryClient)?.[0]?.status).toBe('todo'));
    expect(cachedRows(queryClient)?.[0]?.completed_at).toBeNull();
  });

  it.each([
    ['todo', 'in_progress'],
    ['in_progress', 'todo'],
    ['complete', 'todo'],
    ['complete', 'in_progress'],
  ] as const)(
    'makes no note of a finish when a task goes from %s to %s, and clears an old one',
    async (from, to) => {
      const row = fakeTask({
        status: from,
        completed_at: from === 'complete' ? '2026-09-20T00:00:00Z' : null,
      });
      const { fake, result, queryClient } = await setup(useTaskActions, [row]);
      fake.api.setStatus.mockImplementation(() => new Promise(() => {}));
      act(() => result.current.value.setStatus(row, to));
      await waitFor(() => expect(cachedRows(queryClient)?.[0]?.status).toBe(to));
      expect(cachedRows(queryClient)?.[0]?.completed_at).toBeNull();
    },
  );

  it('puts the old status back and says why when the server refuses', async () => {
    const row = fakeTask({ status: 'todo' });
    const { fake, result, queryClient } = await setup(useTaskActions, [row]);
    fake.api.setStatus.mockRejectedValueOnce(new DataError('network'));
    result.current.value.setStatus(row, 'complete');
    await waitFor(() => expect(result.current.value.error).toMatch(/Can't reach the server/));
    expect(cachedRows(queryClient)?.[0]).toMatchObject({ status: 'todo', completed_at: null });
    act(() => result.current.value.clearError());
    expect(result.current.value.error).toBeNull();
  });

  it('says so when the task was deleted elsewhere in the meantime', async () => {
    const row = fakeTask({ status: 'todo' });
    const { fake, result } = await setup(useTaskActions, [row]);
    fake.api.setStatus.mockRejectedValueOnce(new DataError('not_found'));
    result.current.value.setStatus(row, 'complete');
    await waitFor(() => expect(result.current.value.error).toMatch(/That task no longer exists/));
  });
});

describe('useSaveTask', () => {
  it('adds a new task to the cached list', async () => {
    const existing = fakeTask({ title: 'Existing' });
    const { result, queryClient } = await setup(useSaveTask, [existing]);
    const saved = await act(() => result.current.value.mutateAsync({ fields: fields() }));
    expect(saved).toMatchObject({ title: 'Email the professor' });
    expect(cachedRows(queryClient)?.map((row) => row.title)).toEqual([
      'Existing',
      'Email the professor',
    ]);
  });

  it('replaces the old copy when saving changes to a task', async () => {
    const row = fakeTask({ status: 'todo', priority: 'low' });
    const { fake, result, queryClient } = await setup(useSaveTask, [row]);
    await act(() =>
      result.current.value.mutateAsync({
        id: row.id,
        fields: fields({ title: row.title, status: 'in_progress', priority: 'high' }),
      }),
    );
    expect(fake.api.update).toHaveBeenCalledWith(
      row.id,
      expect.objectContaining({ status: 'in_progress', priority: 'high' }),
    );
    const cached = cachedRows(queryClient)!;
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ id: row.id, status: 'in_progress', priority: 'high' });
  });

  it('leaves the cache alone when saving fails', async () => {
    const row = fakeTask();
    const { fake, result, queryClient } = await setup(useSaveTask, [row]);
    fake.api.create.mockRejectedValueOnce(new DataError('network'));
    await expect(
      act(() => result.current.value.mutateAsync({ fields: fields() })),
    ).rejects.toMatchObject({ kind: 'network' });
    expect(cachedRows(queryClient)).toEqual([row]);
  });

  it('does not invent a list when none has loaded yet', async () => {
    const { result, queryClient } = await setup(useSaveTask, [], { cached: false });
    await act(() => result.current.value.mutateAsync({ fields: fields() }));
    // Nothing to add it to, so it comes from the server on the next read instead.
    await waitFor(() => expect(cachedRows(queryClient)).toBeUndefined());
  });
});

describe('useDeleteTask', () => {
  it('takes the task out of the cached list', async () => {
    const [keep, drop] = [fakeTask({ title: 'Keep' }), fakeTask({ title: 'Drop' })];
    const { fake, result, queryClient } = await setup(useDeleteTask, [keep, drop]);
    await act(() => result.current.value.mutateAsync(drop.id));
    expect(fake.api.remove).toHaveBeenCalledWith(drop.id);
    expect(cachedRows(queryClient)?.map((row) => row.title)).toEqual(['Keep']);
  });

  it('keeps it when the server refuses', async () => {
    const row = fakeTask();
    const { fake, result, queryClient } = await setup(useDeleteTask, [row]);
    fake.api.remove.mockRejectedValueOnce(new DataError('network'));
    await expect(act(() => result.current.value.mutateAsync(row.id))).rejects.toBeDefined();
    expect(cachedRows(queryClient)).toEqual([row]);
  });
});

describe('useApplicationTasks', () => {
  it('gives one program’s tasks, in the order to deal with them', async () => {
    const rows = [
      fakeTask({ title: 'Theirs', application_id: 'other', due_date: '2026-10-01' }),
      fakeTask({ title: 'Nobody’s', application_id: null, due_date: '2026-10-02' }),
      fakeTask({ title: 'Later', application_id: 'mine', due_date: '2026-11-01' }),
      fakeTask({ title: 'Sooner', application_id: 'mine', due_date: '2026-10-05' }),
      fakeTask({
        title: 'Done',
        application_id: 'mine',
        due_date: '2026-09-01',
        status: 'complete',
      }),
    ];
    const { result } = await setup(() => useApplicationTasks('mine'), rows);
    expect(result.current.value.data?.map((row) => row.title)).toEqual(['Sooner', 'Later', 'Done']);
  });
});

describe('useSortedTasks', () => {
  it('gives every task with the open ones first, soonest due first', async () => {
    const rows = [
      fakeTask({ title: 'Done', status: 'complete', completed_at: '2026-09-20T00:00:00Z' }),
      fakeTask({ title: 'No date' }),
      fakeTask({ title: 'Soon', due_date: '2026-10-02' }),
    ];
    const { result } = await setup(useSortedTasks, rows);
    expect(result.current.value.data?.map((row) => row.title)).toEqual(['Soon', 'No date', 'Done']);
  });
});

describe('taskErrorMessage', () => {
  it('explains a program deleted in another tab', () => {
    expect(taskErrorMessage(new DataError('unknown', { cause: { code: '23503' } }))).toBe(
      'The program was deleted in another tab. Reload the page and try again.',
    );
  });

  it('describes anything else for a task', () => {
    expect(taskErrorMessage(new DataError('network'))).toMatch(/Can't reach the server/);
    expect(taskErrorMessage(new DataError('not_found'))).toMatch(/That task no longer exists/);
    expect(taskErrorMessage(new Error('boom'))).toEqual(expect.any(String));
  });
});
