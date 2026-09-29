import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toDataError } from '@/features/applications/errors';
import { useAuth } from '@/features/auth/useAuth';
import { useRequirementsApi } from './api-context';
import { useRequirementsKey } from './keys';
import type { RequirementStatus } from './kinds';
import {
  completionsByApplication,
  sortRequirements,
  type Completion,
  type ProgressLookup,
} from './progress';
import type { RequirementFields, RequirementRow } from './types';

// Like programs, checklist items are read from one cached list (every item on every program). A
// program's page shows its own items from it, and the applications list reads progress from it, so
// the two can never disagree, and a change on one shows on the other at once.

export function useRequirementsQuery<T = RequirementRow[]>(select?: (rows: RequirementRow[]) => T) {
  const api = useRequirementsApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useRequirementsKey(),
    queryFn: () => api.list(),
    enabled: state.status === 'signed_in',
    select,
  });
}

/** One program's checklist, in the order it is shown. */
export function useApplicationRequirements(applicationId: string) {
  const select = useCallback(
    (rows: RequirementRow[]) =>
      sortRequirements(rows.filter((row) => row.application_id === applicationId)),
    [applicationId],
  );
  return useRequirementsQuery(select);
}

const NO_PROGRESS: ReadonlyMap<string, Completion> = new Map();

/** Every program's progress, for the applications list. `retry` asks the server again. */
export function useProgressLookup(): ProgressLookup & { retry: () => void } {
  const { data, isError, refetch } = useRequirementsQuery(completionsByApplication);
  return useMemo(
    () => ({
      status: data ? 'ready' : isError ? 'unavailable' : 'loading',
      byApplication: data ?? NO_PROGRESS,
      retry: () => void refetch(),
    }),
    [data, isError, refetch],
  );
}

/** The message for a failed checklist request. Says "requirement" where the general one would say "application". */
export function requirementErrorMessage(error: unknown): string {
  const failure = toDataError(error);
  return failure.kind === 'not_found'
    ? 'That requirement no longer exists. It may have been deleted in another tab.'
    : failure.message;
}

/** Adds items to a program's checklist, all in one request. Resolves with the new items. */
export function useAddRequirements() {
  const api = useRequirementsApi();
  const queryClient = useQueryClient();
  const key = useRequirementsKey();
  return useMutation({
    mutationFn: ({
      applicationId,
      items,
    }: {
      applicationId: string;
      items: readonly RequirementFields[];
    }) => api.add(applicationId, items),
    onSuccess: (created) => {
      queryClient.setQueryData<RequirementRow[]>(key, (old) => old && [...old, ...created]);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Saves the changes made in the edit form. Resolves with the saved item. */
export function useSaveRequirement() {
  const api = useRequirementsApi();
  const queryClient = useQueryClient();
  const key = useRequirementsKey();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: RequirementFields }) =>
      api.update(id, fields),
    onSuccess: (saved) => {
      queryClient.setQueryData<RequirementRow[]>(
        key,
        (old) => old && old.map((row) => (row.id === saved.id ? saved : row)),
      );
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteRequirement() {
  const api = useRequirementsApi();
  const queryClient = useQueryClient();
  const key = useRequirementsKey();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<RequirementRow[]>(
        key,
        (old) => old && old.filter((row) => row.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

const QUICK_ACTIONS = ['requirements', 'quick-actions'] as const;

/**
 * The one-click change made on a checklist row: its status. It shows immediately and is undone,
 * with a message, if the server refuses.
 */
export function useRequirementActions() {
  const api = useRequirementsApi();
  const queryClient = useQueryClient();
  const key = useRequirementsKey();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationKey: QUICK_ACTIONS,
    // One at a time, in the order they were made: a quick second click must not be applied by the
    // server before the first one.
    scope: { id: 'requirement-quick-actions' },
    mutationFn: ({ id, status }: { id: string; status: RequirementStatus }) =>
      api.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RequirementRow[]>(key);
      queryClient.setQueryData<RequirementRow[]>(key, (old) =>
        old?.map((row) => (row.id === id ? { ...row, status } : row)),
      );
      return { previous };
    },
    onError: (failure, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setError(requirementErrorMessage(failure));
    },
    onSettled: () => {
      // Only look at the server once the last change is in; earlier, it would still show the
      // state from before the changes that are queued behind this one.
      if (queryClient.isMutating({ mutationKey: QUICK_ACTIONS }) <= 1) {
        return queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  // The item as the list has it right now. After a click that the page hasn't drawn yet, that is
  // newer than the row the click came from.
  const newest = (row: RequirementRow) =>
    queryClient.getQueryData<RequirementRow[]>(key)?.find((item) => item.id === row.id) ?? row;

  return {
    setStatus(shown: RequirementRow, status: RequirementStatus) {
      const row = newest(shown);
      if (row.status !== status) mutation.mutate({ id: row.id, status });
    },
    /** Message for the last change that failed, until the next change starts. */
    error,
    clearError: () => setError(null),
  };
}
