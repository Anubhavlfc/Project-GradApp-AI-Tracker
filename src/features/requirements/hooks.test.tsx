import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/useAuth';
import { QueryProvider } from '@/lib/QueryProvider';
import { createQueryClient } from '@/lib/queryClient';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { RequirementsApiContext } from './api-context';
import { useRequirementActions } from './hooks';
import type { RequirementRow } from './types';

/** The status hook with a checklist already in the cache, for a person who is signed in. */
async function setup(rows: RequirementRow[]) {
  const fake = createFakeRequirementsApi(rows);
  const queryClient = createQueryClient({ retry: false });
  queryClient.setQueryData(['requirements', 'user-1'], structuredClone(rows));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider client={createFakeAuth(fakeSession()).client}>
      <RequirementsApiContext value={fake.api}>
        <QueryProvider client={queryClient}>{children}</QueryProvider>
      </RequirementsApiContext>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ actions: useRequirementActions(), auth: useAuth() }), {
    wrapper,
  });
  await waitFor(() => expect(hook.result.current.auth.state.status).toBe('signed_in'));
  return { fake, queryClient, ...hook };
}

describe('useRequirementActions', () => {
  it('sends a status change once, whatever the item had before', async () => {
    const row = fakeRequirement({ status: 'not_started' });
    const { fake, result } = await setup([row]);
    result.current.actions.setStatus(row, 'in_progress');
    await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setStatus).toHaveBeenCalledWith(row.id, 'in_progress');
  });

  it('sends nothing for the status the item already has', async () => {
    const row = fakeRequirement({ status: 'complete' });
    const { fake, result } = await setup([row]);
    result.current.actions.setStatus(row, 'complete');
    await waitFor(() => expect(result.current.actions.error).toBeNull());
    expect(fake.api.setStatus).not.toHaveBeenCalled();
  });

  it('judges a change by the item as it is now, not by the row the click came from', async () => {
    // The page still shows "Not Started", but a change to Complete has already gone through.
    const shown = fakeRequirement({ status: 'not_started' });
    const { fake, result } = await setup([{ ...shown, status: 'complete' }]);

    // Picking Complete again is no change at all...
    result.current.actions.setStatus(shown, 'complete');
    expect(fake.api.setStatus).not.toHaveBeenCalled();

    // ...and picking Not Started is a real one, even though the row on screen says Not Started.
    result.current.actions.setStatus(shown, 'not_started');
    await waitFor(() => expect(fake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(fake.api.setStatus).toHaveBeenCalledWith(shown.id, 'not_started');
  });
});
