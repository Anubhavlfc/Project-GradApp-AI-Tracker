import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { toISODate } from '@/features/applications/dates';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/useAuth';
import { DataError } from '@/lib/dataError';
import { createQueryClient } from '@/lib/queryClient';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import {
  createFakeRecommendationsApi,
  fakeRecommender,
  fakeRequest,
} from '@/test/fakeRecommendationsApi';
import { RecommendationsApiContext } from './api-context';
import {
  requestErrorMessage,
  useDeleteRecommender,
  useRequestActions,
  useRequestsQuery,
  useRecommendersQuery,
  useSaveRequest,
} from './hooks';
import type { RecommenderRow, RequestRow } from './types';

const REQUESTS_KEY = ['recommendation-requests', 'user-1'];
const RECOMMENDERS_KEY = ['recommenders', 'user-1'];

/** The hooks with people and letters already in the cache, for someone who is signed in. */
async function setup<T>(
  useHook: () => T,
  seed: { recommenders?: RecommenderRow[]; requests?: RequestRow[] } = {},
) {
  const fake = createFakeRecommendationsApi(seed);
  const queryClient = createQueryClient({ retry: false });
  queryClient.setQueryData(RECOMMENDERS_KEY, structuredClone(seed.recommenders ?? []));
  queryClient.setQueryData(REQUESTS_KEY, structuredClone(seed.requests ?? []));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider client={createFakeAuth(fakeSession()).client}>
      <RecommendationsApiContext value={fake.api}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </RecommendationsApiContext>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.state.status).toBe('signed_in'));
  return { fake, queryClient, ...hook };
}

describe('useRequestActions', () => {
  it('sends a status change once', async () => {
    const row = fakeRequest({ status: 'not_requested', requested_on: '2026-10-01' });
    const { fake, result } = await setup(useRequestActions, { requests: [row] });
    result.current.value.setStatus(row, 'confirmed');
    await waitFor(() => expect(fake.api.setRequestStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setRequestStatus).toHaveBeenCalledWith(row.id, 'confirmed', undefined);
  });

  it('sends nothing for the status the letter already has', async () => {
    const row = fakeRequest({ status: 'submitted' });
    const { fake, result } = await setup(useRequestActions, { requests: [row] });
    result.current.value.setStatus(row, 'submitted');
    await waitFor(() => expect(result.current.value.error).toBeNull());
    expect(fake.api.setRequestStatus).not.toHaveBeenCalled();
  });

  it('records today as the date asked when the letter becomes Requested without one', async () => {
    const row = fakeRequest({ status: 'not_requested', requested_on: null });
    const { fake, result } = await setup(useRequestActions, { requests: [row] });
    result.current.value.setStatus(row, 'requested');
    await waitFor(() =>
      expect(fake.api.setRequestStatus).toHaveBeenCalledWith(row.id, 'requested', toISODate()),
    );
  });

  it('keeps a date asked that is already there', async () => {
    const row = fakeRequest({ status: 'not_requested', requested_on: '2026-09-15' });
    const { fake, result } = await setup(useRequestActions, { requests: [row] });
    result.current.value.setStatus(row, 'requested');
    await waitFor(() =>
      expect(fake.api.setRequestStatus).toHaveBeenCalledWith(row.id, 'requested', undefined),
    );
  });

  it('judges a change by the letter as it is now, not by the row the click came from', async () => {
    // The page still shows "Not Requested", but a change to Submitted has already gone through.
    const shown = fakeRequest({ status: 'not_requested' });
    const { fake, result } = await setup(useRequestActions, {
      requests: [{ ...shown, status: 'submitted' }],
    });
    result.current.value.setStatus(shown, 'submitted');
    expect(fake.api.setRequestStatus).not.toHaveBeenCalled();
    result.current.value.setStatus(shown, 'not_requested');
    await waitFor(() => expect(fake.api.setRequestStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setRequestStatus).toHaveBeenCalledWith(shown.id, 'not_requested', undefined);
  });

  it('puts the old status back and says why when the server refuses', async () => {
    const row = fakeRequest({ status: 'requested' });
    const { fake, result, queryClient } = await setup(useRequestActions, { requests: [row] });
    fake.api.setRequestStatus.mockRejectedValueOnce(new DataError('network'));
    result.current.value.setStatus(row, 'submitted');
    await waitFor(() => expect(result.current.value.error).toMatch(/Can't reach the server/));
    expect(queryClient.getQueryData<RequestRow[]>(REQUESTS_KEY)?.[0]?.status).toBe('requested');
  });
});

describe('useSaveRequest', () => {
  it('puts the saved request in the cache, replacing the old copy', async () => {
    const row = fakeRequest({ status: 'requested' });
    const { result, queryClient } = await setup(useSaveRequest, { requests: [row] });
    await act(() =>
      result.current.value.mutateAsync({
        id: row.id,
        fields: { status: 'confirmed', requested_on: null, deadline: null, notes: 'ok' },
      }),
    );
    const cached = queryClient.getQueryData<RequestRow[]>(REQUESTS_KEY)!;
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ id: row.id, status: 'confirmed', notes: 'ok' });
  });

  it('adds a new request to the cache', async () => {
    const { result, queryClient } = await setup(useSaveRequest);
    await act(() =>
      result.current.value.mutateAsync({
        request: {
          recommender_id: 'r1',
          application_id: 'a1',
          status: 'not_requested',
          requested_on: null,
          deadline: null,
          notes: null,
        },
      }),
    );
    expect(queryClient.getQueryData<RequestRow[]>(REQUESTS_KEY)).toHaveLength(1);
  });
});

describe('useDeleteRecommender', () => {
  it('takes the person and their letters out of the cache, and only theirs', async () => {
    const people = [fakeRecommender({ id: 'r1' }), fakeRecommender({ id: 'r2' })];
    const requests = [
      fakeRequest({ recommender_id: 'r1' }),
      fakeRequest({ recommender_id: 'r1', application_id: 'application-2' }),
      fakeRequest({ recommender_id: 'r2' }),
    ];
    const { result, queryClient, fake } = await setup(useDeleteRecommender, {
      recommenders: people,
      requests,
    });
    // Hold back the reload, to see what was done to the cache itself.
    fake.api.listRecommenders.mockImplementation(() => new Promise(() => {}));
    fake.api.listRequests.mockImplementation(() => new Promise(() => {}));
    await act(() => result.current.value.mutateAsync('r1'));
    expect(queryClient.getQueryData<RecommenderRow[]>(RECOMMENDERS_KEY)?.map((p) => p.id)).toEqual([
      'r2',
    ]);
    expect(
      queryClient.getQueryData<RequestRow[]>(REQUESTS_KEY)?.map((row) => row.recommender_id),
    ).toEqual(['r2']);
  });
});

describe('the queries', () => {
  it('load people and letters for someone who is signed in', async () => {
    const seed = { recommenders: [fakeRecommender({ id: 'r1' })], requests: [fakeRequest()] };
    const useBoth = () => ({ people: useRecommendersQuery(), letters: useRequestsQuery() });
    const { result, queryClient } = await setup(useBoth, seed);
    queryClient.clear();
    await waitFor(() => expect(result.current.value.people.data).toHaveLength(1));
    await waitFor(() => expect(result.current.value.letters.data).toHaveLength(1));
  });
});

describe('requestErrorMessage', () => {
  const failure = (code: string) => new DataError('unknown', { cause: { code } });

  it('explains a second request for the same person and program', () => {
    expect(requestErrorMessage(failure('23505'))).toBe(
      'That recommender already has a request for this program.',
    );
  });

  it('explains a person or program that has been deleted', () => {
    expect(requestErrorMessage(failure('23503'))).toMatch(/deleted in another tab/);
  });

  it('falls back to the general message', () => {
    expect(requestErrorMessage(new DataError('network'))).toMatch(/Can't reach the server/);
    expect(requestErrorMessage(new DataError('not_found'))).toMatch(
      /That request no longer exists/,
    );
  });
});
