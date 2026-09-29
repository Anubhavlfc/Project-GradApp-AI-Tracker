import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { describeDataError, toDataError } from '@/lib/dataError';
import { upsertRow } from '@/lib/rows';
import { useQuickChange } from '@/lib/useQuickChange';
import { useFundingApi } from './api-context';
import { useFundingKey } from './keys';
import type { FundingStatus } from './kinds';
import {
  fundingByApplication,
  sortFunding,
  type FundingLookup,
  type ProgramFunding,
} from './logic';
import type { FundingFields, FundingRow } from './types';

// Like programs and checklists, funding is read from one cached list (every item, on every program
// and tied to none). A program's Funding tab, the Funding page, the program's overview and the
// applications list all read from it, so they can never disagree, and a change on one shows on the
// others at once.

export function useFundingQuery<T = FundingRow[]>(select?: (rows: FundingRow[]) => T) {
  const api = useFundingApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useFundingKey(),
    queryFn: () => api.list(),
    enabled: state.status === 'signed_in',
    select,
  });
}

/** One program's funding, in the order to deal with it. */
export function useApplicationFunding(applicationId: string) {
  const select = useCallback(
    (rows: FundingRow[]) => sortFunding(rows.filter((row) => row.application_id === applicationId)),
    [applicationId],
  );
  return useFundingQuery(select);
}

/** Everything, in the order to deal with it: the Funding page. */
export function useSortedFunding() {
  return useFundingQuery(sortFunding);
}

const NO_FUNDING: ReadonlyMap<string, ProgramFunding> = new Map();

/** Every program's funding, for the applications list. `retry` asks the server again. */
export function useFundingLookup(): FundingLookup & { retry: () => void } {
  const { data, isError, refetch } = useFundingQuery(fundingByApplication);
  return useMemo(
    () => ({
      status: data ? 'ready' : isError ? 'unavailable' : 'loading',
      byApplication: data ?? NO_FUNDING,
      retry: () => void refetch(),
    }),
    [data, isError, refetch],
  );
}

function codeOf(cause: unknown): string {
  return typeof cause === 'object' && cause !== null
    ? String((cause as Record<string, unknown>).code ?? '')
    : '';
}

/** The message for a failed funding request. */
export function fundingErrorMessage(error: unknown): string {
  const failure = toDataError(error);
  if (codeOf(failure.cause) === '23503') {
    return 'The program was deleted in another tab. Reload the page and try again.';
  }
  return describeDataError(failure, 'funding item');
}

/** Adds a funding item, or saves changes to one when `id` is given. Resolves with the saved item. */
export function useSaveFunding() {
  const api = useFundingApi();
  const queryClient = useQueryClient();
  const key = useFundingKey();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: FundingFields }) =>
      id ? api.update(id, fields) : api.create(fields),
    onSuccess: (saved) => {
      queryClient.setQueryData<FundingRow[]>(key, (old) => old && upsertRow(old, saved));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteFunding() {
  const api = useFundingApi();
  const queryClient = useQueryClient();
  const key = useFundingKey();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<FundingRow[]>(
        key,
        (old) => old && old.filter((row) => row.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * The one-click change made on a funding item: its status. It shows immediately and is undone,
 * with a message, if the server refuses.
 */
export function useFundingActions() {
  const api = useFundingApi();
  const quick = useQuickChange<FundingRow, { status: FundingStatus }>({
    key: useFundingKey(),
    scope: 'funding-status',
    send: (id, { status }) => api.setStatus(id, status),
    errorMessage: fundingErrorMessage,
  });

  return {
    setStatus(shown: FundingRow, status: FundingStatus) {
      quick.change(shown, (row) => (row.status === status ? null : { status }));
    },
    /** Message for the last change that failed, until the next change starts. */
    error: quick.error,
    clearError: quick.clearError,
  };
}
