import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/useAuth';
import { DataError } from '@/lib/dataError';
import { createQueryClient } from '@/lib/queryClient';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeFundingApi, fakeFunding } from '@/test/fakeFundingApi';
import { FundingApiContext } from './api-context';
import {
  fundingErrorMessage,
  useApplicationFunding,
  useDeleteFunding,
  useFundingActions,
  useFundingLookup,
  useSaveFunding,
} from './hooks';
import type { FundingFields, FundingRow } from './types';

const KEY = ['funding', 'user-1'];

type Fake = ReturnType<typeof createFakeFundingApi>;

/** The hooks for someone who is signed in, with the list already in the cache unless `cached` is false. */
async function setup<T>(
  useHook: () => T,
  seed: FundingRow[] = [],
  { cached = true, before }: { cached?: boolean; before?: (fake: Fake) => void } = {},
) {
  const fake = createFakeFundingApi(seed);
  before?.(fake);
  const queryClient = createQueryClient({ retry: false });
  if (cached) queryClient.setQueryData(KEY, structuredClone(seed));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider client={createFakeAuth(fakeSession()).client}>
      <FundingApiContext value={fake.api}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </FundingApiContext>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.state.status).toBe('signed_in'));
  return { fake, queryClient, ...hook };
}

const cachedRows = (queryClient: ReturnType<typeof createQueryClient>) =>
  queryClient.getQueryData<FundingRow[]>(KEY);

const fields = (overrides: Partial<FundingFields> = {}): FundingFields => ({
  application_id: null,
  name: 'Fellowship',
  kind: 'fellowship',
  amount: null,
  currency: 'USD',
  deadline: null,
  application_required: false,
  status: 'researching',
  url: null,
  notes: null,
  ...overrides,
});

describe('useFundingActions', () => {
  it('sends a status change once', async () => {
    const row = fakeFunding({ status: 'applying' });
    const { fake, result } = await setup(useFundingActions, [row]);
    result.current.value.setStatus(row, 'applied');
    await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setStatus).toHaveBeenCalledWith(row.id, 'applied');
  });

  it('sends nothing for the status the item already has', async () => {
    const row = fakeFunding({ status: 'offered' });
    const { fake, result } = await setup(useFundingActions, [row]);
    result.current.value.setStatus(row, 'offered');
    await waitFor(() => expect(result.current.value.error).toBeNull());
    expect(fake.api.setStatus).not.toHaveBeenCalled();
  });

  it('judges a change by the item as it is now, not by the row the click came from', async () => {
    // The page still shows "Researching", but a change to Applied has already gone through.
    const shown = fakeFunding({ status: 'researching' });
    const { fake, result } = await setup(useFundingActions, [{ ...shown, status: 'applied' }]);
    result.current.value.setStatus(shown, 'applied');
    expect(fake.api.setStatus).not.toHaveBeenCalled();
    result.current.value.setStatus(shown, 'researching');
    await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setStatus).toHaveBeenCalledWith(shown.id, 'researching');
  });

  it('shows the new status at once', async () => {
    const row = fakeFunding({ status: 'applying' });
    const { fake, result, queryClient } = await setup(useFundingActions, [row]);
    fake.api.setStatus.mockImplementationOnce(() => new Promise(() => {}));
    act(() => result.current.value.setStatus(row, 'accepted'));
    await waitFor(() => expect(cachedRows(queryClient)?.[0]?.status).toBe('accepted'));
    expect(fake.api.setStatus).toHaveBeenCalledTimes(1);
  });

  it('puts the old status back and says why when the server refuses', async () => {
    const row = fakeFunding({ status: 'applying' });
    const { fake, result, queryClient } = await setup(useFundingActions, [row]);
    fake.api.setStatus.mockRejectedValueOnce(new DataError('network'));
    result.current.value.setStatus(row, 'accepted');
    await waitFor(() => expect(result.current.value.error).toMatch(/Can't reach the server/));
    expect(cachedRows(queryClient)?.[0]?.status).toBe('applying');
    act(() => result.current.value.clearError());
    expect(result.current.value.error).toBeNull();
  });

  it('says so when the item was deleted elsewhere in the meantime', async () => {
    const row = fakeFunding({ status: 'applying' });
    const { fake, result } = await setup(useFundingActions, [row]);
    fake.api.setStatus.mockRejectedValueOnce(new DataError('not_found'));
    result.current.value.setStatus(row, 'accepted');
    await waitFor(() =>
      expect(result.current.value.error).toMatch(/That funding item no longer exists/),
    );
  });
});

describe('useSaveFunding', () => {
  it('adds a new item to the cached list', async () => {
    const existing = fakeFunding({ name: 'Existing' });
    const { result, queryClient } = await setup(useSaveFunding, [existing]);
    const saved = await act(() => result.current.value.mutateAsync({ fields: fields() }));
    expect(saved).toMatchObject({ name: 'Fellowship' });
    expect(cachedRows(queryClient)?.map((row) => row.name)).toEqual(['Existing', 'Fellowship']);
  });

  it('replaces the old copy when saving changes to an item', async () => {
    const row = fakeFunding({ status: 'applying', amount: 1 });
    const { fake, result, queryClient } = await setup(useSaveFunding, [row]);
    await act(() =>
      result.current.value.mutateAsync({
        id: row.id,
        fields: fields({ name: row.name, status: 'offered', amount: 500 }),
      }),
    );
    expect(fake.api.update).toHaveBeenCalledWith(
      row.id,
      expect.objectContaining({ status: 'offered', amount: 500 }),
    );
    const cached = cachedRows(queryClient)!;
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ id: row.id, status: 'offered', amount: 500 });
  });

  it('leaves the cache alone when saving fails', async () => {
    const row = fakeFunding();
    const { fake, result, queryClient } = await setup(useSaveFunding, [row]);
    fake.api.create.mockRejectedValueOnce(new DataError('network'));
    await expect(
      act(() => result.current.value.mutateAsync({ fields: fields() })),
    ).rejects.toMatchObject({ kind: 'network' });
    expect(cachedRows(queryClient)).toEqual([row]);
  });

  it('does not invent a list when none has loaded yet', async () => {
    const { result, queryClient } = await setup(useSaveFunding, [], { cached: false });
    await act(() => result.current.value.mutateAsync({ fields: fields() }));
    // Nothing to add it to, so it comes from the server on the next read instead.
    await waitFor(() => expect(cachedRows(queryClient)).toBeUndefined());
  });
});

describe('useDeleteFunding', () => {
  it('takes the item out of the cached list', async () => {
    const [keep, drop] = [fakeFunding({ name: 'Keep' }), fakeFunding({ name: 'Drop' })];
    const { fake, result, queryClient } = await setup(useDeleteFunding, [keep, drop]);
    await act(() => result.current.value.mutateAsync(drop.id));
    expect(fake.api.remove).toHaveBeenCalledWith(drop.id);
    expect(cachedRows(queryClient)?.map((row) => row.name)).toEqual(['Keep']);
  });

  it('keeps it when the server refuses', async () => {
    const row = fakeFunding();
    const { fake, result, queryClient } = await setup(useDeleteFunding, [row]);
    fake.api.remove.mockRejectedValueOnce(new DataError('network'));
    await expect(act(() => result.current.value.mutateAsync(row.id))).rejects.toBeDefined();
    expect(cachedRows(queryClient)).toEqual([row]);
  });
});

describe('useApplicationFunding', () => {
  it('gives one program’s funding, in the order to deal with it', async () => {
    const rows = [
      fakeFunding({ name: 'Theirs', application_id: 'other' }),
      fakeFunding({ name: 'Nobody’s', application_id: null }),
      fakeFunding({ name: 'Offer', application_id: 'mine', status: 'offered' }),
      fakeFunding({ name: 'Open', application_id: 'mine', status: 'applying' }),
    ];
    const { result } = await setup(() => useApplicationFunding('mine'), rows);
    expect(result.current.value.data?.map((row) => row.name)).toEqual(['Open', 'Offer']);
  });
});

describe('useFundingLookup', () => {
  const rows = () => [
    fakeFunding({ application_id: 'a', status: 'accepted', amount: 100 }),
    fakeFunding({ application_id: 'b', status: 'researching' }),
    fakeFunding({ application_id: null, status: 'accepted', amount: 999 }),
  ];

  it('is loading, with nothing in it, then ready with each program’s summary', async () => {
    const seed = rows();
    let release = () => {};
    const { result } = await setup(useFundingLookup, seed, {
      cached: false,
      before: (fake) =>
        fake.api.list.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              release = () => resolve(structuredClone(seed));
            }),
        ),
    });
    expect(result.current.value.status).toBe('loading');
    expect(result.current.value.byApplication.size).toBe(0);

    act(() => release());
    await waitFor(() => expect(result.current.value.status).toBe('ready'));
    const { byApplication } = result.current.value;
    // Funding tied to no program is nobody's.
    expect([...byApplication.keys()].sort()).toEqual(['a', 'b']);
    expect(byApplication.get('a')).toMatchObject({ hasOffer: true, pursuing: false });
    expect(byApplication.get('b')).toMatchObject({ hasOffer: false, pursuing: true });
  });

  it('is unavailable when the funding cannot be loaded, and can try again', async () => {
    const { result } = await setup(useFundingLookup, rows(), {
      cached: false,
      before: (fake) => fake.api.list.mockRejectedValueOnce(new DataError('network')),
    });
    await waitFor(() => expect(result.current.value.status).toBe('unavailable'));
    expect(result.current.value.byApplication.size).toBe(0);

    act(() => result.current.value.retry());
    await waitFor(() => expect(result.current.value.status).toBe('ready'));
    expect(result.current.value.byApplication.size).toBe(2);
  });

  it('is ready with nothing in it when there is no funding at all', async () => {
    const { result } = await setup(useFundingLookup, []);
    await waitFor(() => expect(result.current.value.status).toBe('ready'));
    expect(result.current.value.byApplication.size).toBe(0);
  });
});

describe('fundingErrorMessage', () => {
  it('explains a program deleted in another tab', () => {
    expect(fundingErrorMessage(new DataError('unknown', { cause: { code: '23503' } }))).toBe(
      'The program was deleted in another tab. Reload the page and try again.',
    );
  });

  it('describes anything else for a funding item', () => {
    expect(fundingErrorMessage(new DataError('network'))).toMatch(/Can't reach the server/);
    expect(fundingErrorMessage(new DataError('not_found'))).toMatch(
      /That funding item no longer exists/,
    );
    expect(fundingErrorMessage(new Error('boom'))).toEqual(expect.any(String));
  });
});
