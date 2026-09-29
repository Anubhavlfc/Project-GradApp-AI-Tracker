import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { describeDataError, toDataError } from '@/lib/dataError';
import { upsertRow } from '@/lib/rows';
import { useQuickChange } from '@/lib/useQuickChange';
import { useTasksApi } from './api-context';
import { useTasksKey } from './keys';
import type { TaskStatus } from './kinds';
import { sortTasks } from './logic';
import type { TaskFields, TaskRow } from './types';

// Like programs and checklists, tasks are read from one cached list (every task, on every program
// and tied to none). The Tasks page, a program's Tasks tab and Overview card, the Deadlines page
// and the dashboard all read from it, so they can never disagree, and a change on one shows on the
// others at once.

export function useTasksQuery<T = TaskRow[]>(select?: (rows: TaskRow[]) => T) {
  const api = useTasksApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useTasksKey(),
    queryFn: () => api.list(),
    enabled: state.status === 'signed_in',
    select,
  });
}

/** One program's tasks, in the order to deal with them. */
export function useApplicationTasks(applicationId: string) {
  const select = useCallback(
    (rows: TaskRow[]) => sortTasks(rows.filter((row) => row.application_id === applicationId)),
    [applicationId],
  );
  return useTasksQuery(select);
}

/** Everything, in the order to deal with it: the Tasks page. */
export function useSortedTasks() {
  return useTasksQuery(sortTasks);
}

function codeOf(cause: unknown): string {
  return typeof cause === 'object' && cause !== null
    ? String((cause as Record<string, unknown>).code ?? '')
    : '';
}

/** The message for a failed task request. */
export function taskErrorMessage(error: unknown): string {
  const failure = toDataError(error);
  if (codeOf(failure.cause) === '23503') {
    return 'The program was deleted in another tab. Reload the page and try again.';
  }
  return describeDataError(failure, 'task');
}

/** Adds a task, or saves changes to one when `id` is given. Resolves with the saved task. */
export function useSaveTask() {
  const api = useTasksApi();
  const queryClient = useQueryClient();
  const key = useTasksKey();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: TaskFields }) =>
      id ? api.update(id, fields) : api.create(fields),
    onSuccess: (saved) => {
      queryClient.setQueryData<TaskRow[]>(key, (old) => old && upsertRow(old, saved));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteTask() {
  const api = useTasksApi();
  const queryClient = useQueryClient();
  const key = useTasksKey();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<TaskRow[]>(key, (old) => old && old.filter((row) => row.id !== id));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * The one-click change made on a task: its status. It shows immediately and is undone, with a
 * message, if the server refuses. The database notes when a task was completed; the copy on screen
 * gets the same note (a moment earlier than the server's) so a task you just finished sorts with
 * the finished ones straight away and does not jump when the list is read again.
 */
export function useTaskActions() {
  const api = useTasksApi();
  const quick = useQuickChange<TaskRow, { status: TaskStatus; completed_at: string | null }>({
    key: useTasksKey(),
    scope: 'task-status',
    send: (id, { status }) => api.setStatus(id, status),
    errorMessage: taskErrorMessage,
  });

  return {
    setStatus(shown: TaskRow, status: TaskStatus) {
      quick.change(shown, (row) =>
        row.status === status
          ? null
          : { status, completed_at: status === 'complete' ? new Date().toISOString() : null },
      );
    },
    /** Message for the last change that failed, until the next change starts. */
    error: quick.error,
    clearError: quick.clearError,
  };
}
