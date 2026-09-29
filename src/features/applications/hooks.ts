import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useApplicationsApi } from './api-context';
import { toISODate } from './dates';
import { useDependentKeys } from './dependents';
import { toDataError } from '@/lib/dataError';
import type { ApplicationStatus } from './status';
import type { ApplicationInput, ApplicationRecord } from './types';

// Every screen reads applications from one cached list. Detail pages find their program in it,
// so the list and the details can never disagree, and editing one updates the other at once.

function useListKey() {
  const { state } = useAuth();
  // Keyed by person, so one account's cache can never be shown to another.
  return ['applications', state.status === 'signed_in' ? state.user.id : 'signed-out'] as const;
}

export function useApplicationsQuery<T = ApplicationRecord[]>(
  select?: (records: ApplicationRecord[]) => T,
) {
  const api = useApplicationsApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useListKey(),
    queryFn: () => api.list(),
    enabled: state.status === 'signed_in',
    select,
  });
}

/** One program by id: the record, or null when there is no such program (yet loaded). */
export function useApplication(id: string | undefined) {
  const select = useCallback(
    (records: ApplicationRecord[]) => records.find((record) => record.id === id) ?? null,
    [id],
  );
  return useApplicationsQuery(select);
}

function upsert(records: ApplicationRecord[], record: ApplicationRecord): ApplicationRecord[] {
  return records.some((item) => item.id === record.id)
    ? records.map((item) => (item.id === record.id ? record : item))
    : [...records, record];
}

/** Creates a program, or saves changes to one when `id` is given. Resolves with the saved record. */
export function useSaveApplication() {
  const api = useApplicationsApi();
  const queryClient = useQueryClient();
  const key = useListKey();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ApplicationInput }) =>
      id ? api.update(id, input) : api.create(input),
    onSuccess: (record) => {
      // Put the saved record in the cache before anyone navigates to it, then check with the server.
      queryClient.setQueryData<ApplicationRecord[]>(key, (old) => old && upsert(old, record));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Saves a program's notes on their own, and puts the saved program in the list. */
export function useSaveNotes() {
  const api = useApplicationsApi();
  const queryClient = useQueryClient();
  const key = useListKey();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string | null }) => api.setNotes(id, notes),
    onSuccess: (record) => {
      queryClient.setQueryData<ApplicationRecord[]>(key, (old) => old && upsert(old, record));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export type SaveOutcome = { ok: true; record: ApplicationRecord } | { ok: false; message: string };

/** A save function shaped for the form: it never throws, it says whether it worked and why not. */
export function useApplicationSaver(id?: string) {
  const { mutateAsync } = useSaveApplication();
  return useCallback(
    async (input: ApplicationInput): Promise<SaveOutcome> => {
      try {
        return { ok: true, record: await mutateAsync({ id, input }) };
      } catch (error) {
        return { ok: false, message: toDataError(error).message };
      }
    },
    [mutateAsync, id],
  );
}

export function useDeleteApplication() {
  const api = useApplicationsApi();
  const queryClient = useQueryClient();
  const key = useListKey();
  const dependentKeys = useDependentKeys();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<ApplicationRecord[]>(
        key,
        (old) => old && old.filter((record) => record.id !== id),
      );
      // The program's checklist, letters and so on went with it in the database; drop them here too.
      for (const dependentKey of dependentKeys) {
        queryClient.setQueryData<{ application_id: string }[]>(
          dependentKey,
          (old) => old && old.filter((row) => row.application_id !== id),
        );
        void queryClient.invalidateQueries({ queryKey: dependentKey });
      }
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

const QUICK_ACTIONS = ['applications', 'quick-actions'] as const;

/**
 * One-click changes made from the list: status and favorite. They show immediately and are
 * undone, with a message, if the server refuses.
 */
export function useQuickActions() {
  const api = useApplicationsApi();
  const queryClient = useQueryClient();
  const key = useListKey();
  const [error, setError] = useState<string | null>(null);

  type Change = { id: string; changes: Partial<ApplicationRecord>; save: () => Promise<void> };
  const mutation = useMutation({
    mutationKey: QUICK_ACTIONS,
    // One at a time, in the order they were made: a quick second click must not be applied by the
    // server before the first one.
    scope: { id: 'quick-actions' },
    mutationFn: ({ save }: Change) => save(),
    onMutate: async ({ id, changes }) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ApplicationRecord[]>(key);
      queryClient.setQueryData<ApplicationRecord[]>(key, (old) =>
        old?.map((record) => (record.id === id ? { ...record, ...changes } : record)),
      );
      return { previous };
    },
    onError: (error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setError(toDataError(error).message);
    },
    onSettled: () => {
      // Only look at the server once the last change is in; earlier, it would still show the
      // state from before the changes that are queued behind this one.
      if (queryClient.isMutating({ mutationKey: QUICK_ACTIONS }) <= 1) {
        return queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  // The program as the list has it right now. After a click that the page hasn't drawn yet, that
  // is newer than the record the click came from.
  const newest = (record: ApplicationRecord) =>
    queryClient.getQueryData<ApplicationRecord[]>(key)?.find((item) => item.id === record.id) ??
    record;

  return {
    setStatus(shown: ApplicationRecord, status: ApplicationStatus) {
      const record = newest(shown);
      // Marking something submitted also records today as the date, unless you already gave one.
      // Jumping straight to a later status (say, back-filling an old acceptance) leaves the date
      // alone: today would be wrong.
      const submittedOn = status === 'submitted' && !record.submitted_on ? toISODate() : undefined;
      mutation.mutate({
        id: record.id,
        changes: { status, ...(submittedOn ? { submitted_on: submittedOn } : {}) },
        save: () => api.setStatus(record.id, status, submittedOn),
      });
    },
    toggleFavorite(shown: ApplicationRecord) {
      const record = newest(shown);
      const is_favorite = !record.is_favorite;
      mutation.mutate({
        id: record.id,
        changes: { is_favorite },
        save: () => api.setFavorite(record.id, is_favorite),
      });
    },
    /** Message for the last change that failed, until the next change starts. */
    error,
    clearError: () => setError(null),
  };
}
