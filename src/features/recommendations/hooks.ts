import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toISODate } from '@/features/applications/dates';
import { useAuth } from '@/features/auth/useAuth';
import { describeDataError, toDataError } from '@/lib/dataError';
import { upsertRow } from '@/lib/rows';
import { useQuickChange } from '@/lib/useQuickChange';
import { useRecommendationsApi } from './api-context';
import { useRecommendersKey, useRequestsKey } from './keys';
import { sortRecommenders, sortRequests } from './logic';
import type { RecommendationStatus } from './statuses';
import type {
  NewRequest,
  RecommenderFields,
  RecommenderRow,
  RequestFields,
  RequestRow,
} from './types';

// Like programs and checklists, recommenders and letter requests are read from one cached list
// each. A program's Recommendations tab, the Recommenders page and the program's overview all read
// from them, so they can never disagree, and a change on one shows on the others at once.

export function useRecommendersQuery<T = RecommenderRow[]>(select?: (rows: RecommenderRow[]) => T) {
  const api = useRecommendationsApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useRecommendersKey(),
    queryFn: () => api.listRecommenders(),
    enabled: state.status === 'signed_in',
    select,
  });
}

export function useRequestsQuery<T = RequestRow[]>(select?: (rows: RequestRow[]) => T) {
  const api = useRecommendationsApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useRequestsKey(),
    queryFn: () => api.listRequests(),
    enabled: state.status === 'signed_in',
    select,
  });
}

export type RecommendationData = {
  /** Undefined until they have loaded. */
  recommenders: RecommenderRow[] | undefined;
  requests: RequestRow[] | undefined;
  /** True when one of the lists could not be loaded and there is nothing to show instead. */
  failed: boolean;
  /** True when a list could not be refreshed but the last copy of it is still there to show. */
  stale: boolean;
  error: unknown;
  retry: () => void;
};

/** Both lists together, for screens that need people and letters side by side. */
export function useRecommendationData(): RecommendationData {
  const recommenders = useRecommendersQuery();
  const requests = useRequestsQuery();
  const { refetch: refetchRecommenders } = recommenders;
  const { refetch: refetchRequests } = requests;
  const failed =
    (recommenders.data === undefined && recommenders.isError) ||
    (requests.data === undefined && requests.isError);
  return {
    recommenders: recommenders.data && sortRecommenders(recommenders.data),
    requests: requests.data,
    failed,
    stale: !failed && (recommenders.isError || requests.isError),
    error: recommenders.error ?? requests.error,
    retry: () => {
      void refetchRecommenders();
      void refetchRequests();
    },
  };
}

/** A letter request together with the person who is writing it. */
export type Letter = { request: RequestRow; recommender: RecommenderRow };

/** One program's letters, soonest deadline first. `letters` is undefined until both lists load. */
export function useApplicationLetters(applicationId: string) {
  const data = useRecommendationData();
  const { recommenders, requests } = data;
  const letters = useMemo(() => {
    if (!recommenders || !requests) return undefined;
    const byId = new Map(recommenders.map((person) => [person.id, person]));
    const joined = requests
      .filter((request) => request.application_id === applicationId)
      .flatMap((request) => {
        const recommender = byId.get(request.recommender_id);
        return recommender ? [{ request, recommender }] : [];
      });
    const order = new Map(
      sortRequests(
        joined.map((letter) => letter.request),
        (request) => byId.get(request.recommender_id)?.name ?? '',
      ).map((request, index) => [request.id, index]),
    );
    return joined.sort((a, b) => (order.get(a.request.id) ?? 0) - (order.get(b.request.id) ?? 0));
  }, [recommenders, requests, applicationId]);
  return { ...data, letters };
}

/** Requests for one program only: what the overview card needs. */
export function useApplicationRequests(applicationId: string) {
  const select = useCallback(
    (rows: RequestRow[]) => rows.filter((row) => row.application_id === applicationId),
    [applicationId],
  );
  return useRequestsQuery(select);
}

// ---------------------------------------------------------------------------------------------
// Messages

export function recommenderErrorMessage(error: unknown): string {
  return describeDataError(error, 'recommender');
}

function codeOf(cause: unknown): string {
  return typeof cause === 'object' && cause !== null
    ? String((cause as Record<string, unknown>).code ?? '')
    : '';
}

/** The message for a failed letter request. A second request for the same pair gets its own. */
export function requestErrorMessage(error: unknown): string {
  const failure = toDataError(error);
  const code = codeOf(failure.cause);
  if (code === '23505') return 'That recommender already has a request for this program.';
  if (code === '23503') {
    return 'The recommender or the program was deleted in another tab. Reload the page and try again.';
  }
  return describeDataError(failure, 'request');
}

// ---------------------------------------------------------------------------------------------
// Changes

/** Adds a recommender, or saves changes to one when `id` is given. Resolves with the saved person. */
export function useSaveRecommender() {
  const api = useRecommendationsApi();
  const queryClient = useQueryClient();
  const key = useRecommendersKey();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: RecommenderFields }) =>
      id ? api.updateRecommender(id, fields) : api.createRecommender(fields),
    onSuccess: (saved) => {
      queryClient.setQueryData<RecommenderRow[]>(key, (old) => old && upsertRow(old, saved));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Deletes a recommender. Their letter requests go with them, here as in the database. */
export function useDeleteRecommender() {
  const api = useRecommendationsApi();
  const queryClient = useQueryClient();
  const key = useRecommendersKey();
  const requestsKey = useRequestsKey();
  return useMutation({
    mutationFn: (id: string) => api.deleteRecommender(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<RecommenderRow[]>(
        key,
        (old) => old && old.filter((row) => row.id !== id),
      );
      queryClient.setQueryData<RequestRow[]>(
        requestsKey,
        (old) => old && old.filter((row) => row.recommender_id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: requestsKey });
    },
  });
}

/** Adds a letter request, or saves changes to one when `id` is given. Resolves with the saved request. */
export function useSaveRequest() {
  const api = useRecommendationsApi();
  const queryClient = useQueryClient();
  const key = useRequestsKey();
  return useMutation({
    mutationFn: (change: { id: string; fields: RequestFields } | { request: NewRequest }) =>
      'request' in change
        ? api.createRequest(change.request)
        : api.updateRequest(change.id, change.fields),
    onSuccess: (saved) => {
      queryClient.setQueryData<RequestRow[]>(key, (old) => old && upsertRow(old, saved));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteRequest() {
  const api = useRecommendationsApi();
  const queryClient = useQueryClient();
  const key = useRequestsKey();
  return useMutation({
    mutationFn: (id: string) => api.deleteRequest(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<RequestRow[]>(
        key,
        (old) => old && old.filter((row) => row.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * The one-click change made on a letter: its status. It shows immediately and is undone, with a
 * message, if the server refuses.
 */
export function useRequestActions() {
  const api = useRecommendationsApi();
  const quick = useQuickChange<RequestRow, { status: RecommendationStatus; requested_on?: string }>(
    {
      key: useRequestsKey(),
      scope: 'recommendation-status',
      send: (id, { status, requested_on }) => api.setRequestStatus(id, status, requested_on),
      errorMessage: requestErrorMessage,
    },
  );

  return {
    setStatus(shown: RequestRow, status: RecommendationStatus) {
      quick.change(shown, (row) => {
        if (row.status === status) return null;
        // Asking for the letter also records today as the date asked, unless you already gave
        // one. Jumping straight to a later status (back-filling an old letter) leaves the date
        // alone: today would be wrong.
        const requestedOn = status === 'requested' && !row.requested_on ? toISODate() : undefined;
        return requestedOn ? { status, requested_on: requestedOn } : { status };
      });
    },
    /** Message for the last change that failed, until the next change starts. */
    error: quick.error,
    clearError: quick.clearError,
  };
}
