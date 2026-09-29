import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/useAuth';
import { DataError } from '@/lib/dataError';
import { createQueryClient } from '@/lib/queryClient';
import { createFakeActivityApi, fakeActivity } from '@/test/fakeActivityApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { ActivityApiContext } from './api-context';
import { ACTIVITY_LIMIT, useRecentActivity } from './hooks';

async function setup(seed = [fakeActivity()], { signedIn = true }: { signedIn?: boolean } = {}) {
  const fake = createFakeActivityApi(seed);
  const queryClient = createQueryClient({ retry: false });
  const auth = createFakeAuth(signedIn ? fakeSession() : null);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider client={auth.client}>
      <ActivityApiContext value={fake.api}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ActivityApiContext>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ activity: useRecentActivity(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.state.status).not.toBe('loading'));
  return { fake, queryClient, ...hook };
}

describe('useRecentActivity', () => {
  it('reads the latest entries, up to the limit, once signed in', async () => {
    const rows = Array.from({ length: ACTIVITY_LIMIT + 3 }, (_, index) =>
      fakeActivity({ created_at: `2026-09-01T12:${String(index).padStart(2, '0')}:00+00:00` }),
    );
    const { fake, result } = await setup(rows);
    await waitFor(() => expect(result.current.activity.data).toBeDefined());
    expect(fake.api.recent).toHaveBeenCalledWith(ACTIVITY_LIMIT);
    expect(result.current.activity.data).toHaveLength(ACTIVITY_LIMIT);
    // Newest first.
    expect(result.current.activity.data?.[0]?.created_at).toBe(rows.at(-1)?.created_at);
  });

  it('is cached for this person only', async () => {
    const { queryClient, result } = await setup();
    await waitFor(() => expect(result.current.activity.data).toBeDefined());
    expect(queryClient.getQueryData(['activity', 'user-1'])).toBeDefined();
  });

  it('does not ask while signed out', async () => {
    const { fake, result } = await setup([], { signedIn: false });
    expect(result.current.activity.data).toBeUndefined();
    expect(result.current.activity.fetchStatus).toBe('idle');
    expect(fake.api.recent).not.toHaveBeenCalled();
  });

  it('is read again every time a screen opens, since the app cannot know what the database logged', async () => {
    const { fake, queryClient, result } = await setup();
    await waitFor(() => expect(result.current.activity.data).toBeDefined());
    expect(fake.api.recent).toHaveBeenCalledTimes(1);

    // A second screen that shows it mounts within the default 30 seconds: still fetched again.
    const again = renderHook(() => useRecentActivity(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AuthProvider client={createFakeAuth(fakeSession()).client}>
          <ActivityApiContext value={fake.api}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </ActivityApiContext>
        </AuthProvider>
      ),
    });
    await waitFor(() => expect(fake.api.recent).toHaveBeenCalledTimes(2));
    again.unmount();
  });

  it('says why when it cannot be read', async () => {
    const fake = createFakeActivityApi();
    fake.api.recent.mockRejectedValueOnce(new DataError('network'));
    const queryClient = createQueryClient({ retry: false });
    const { result } = renderHook(() => useRecentActivity(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AuthProvider client={createFakeAuth(fakeSession()).client}>
          <ActivityApiContext value={fake.api}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </ActivityApiContext>
        </AuthProvider>
      ),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(DataError);
  });
});
