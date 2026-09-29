import { act, render, waitFor } from '@testing-library/react';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { authError, createFakeAuth, fakeSession, fakeUser } from '@/test/fakeAuth';
import type { AuthContextValue } from './auth-context';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

function mount(client: Parameters<typeof AuthProvider>[0]['client']) {
  const latest: { value: AuthContextValue | null; renders: number } = { value: null, renders: 0 };
  function Probe() {
    latest.value = useAuth();
    latest.renders += 1;
    return null;
  }
  const view = render(
    <AuthProvider client={client}>
      <Probe />
    </AuthProvider>,
  );
  return {
    ...view,
    latest,
    auth: () => {
      if (!latest.value) throw new Error('not rendered');
      return latest.value;
    },
  };
}

describe('AuthProvider state', () => {
  it('starts loading, then reports signed out when there is no session', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    expect(auth().state).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(auth().state).toEqual({ status: 'signed_out', sessionEnded: false }),
    );
  });

  it('reports the signed-in user for a stored session', async () => {
    const fake = createFakeAuth(fakeSession(fakeUser({ email: 'grace@example.com' })));
    const { auth } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
    expect(auth().state).toMatchObject({ user: { email: 'grace@example.com' } });
  });

  it('is unconfigured, and every action refuses, when there is no client', async () => {
    const { auth } = mount(null);
    expect(auth().state).toEqual({ status: 'unconfigured' });
    const expected = { ok: false, message: 'Sign-in is not set up yet.' };
    expect(await auth().signIn({ email: 'a@b.co', password: 'x' })).toEqual(expected);
    expect(await auth().signUp({ email: 'a@b.co', password: 'x' })).toEqual(expected);
    expect(await auth().signOut()).toEqual(expected);
    expect(await auth().requestPasswordReset('a@b.co')).toEqual(expected);
    expect(await auth().updatePassword('x')).toEqual(expected);
  });

  it('falls back to getSession when the client never announces the initial session', async () => {
    const fake = createFakeAuth(fakeSession());
    fake.client.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { id: 'quiet', callback: () => {}, unsubscribe: () => {} } },
    }));
    const { auth } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
  });

  it('becomes signed out (not stuck loading) if reading the session fails', async () => {
    const fake = createFakeAuth();
    fake.client.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { id: 'quiet', callback: () => {}, unsubscribe: () => {} } },
    }));
    fake.client.getSession.mockRejectedValue(new TypeError('Failed to fetch'));
    const { auth } = mount(fake.client);
    await waitFor(() =>
      expect(auth().state).toEqual({ status: 'signed_out', sessionEnded: false }),
    );
  });

  it('marks the session as ended when it disappears without the person signing out', async () => {
    const fake = createFakeAuth(fakeSession());
    const { auth } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
    act(() => fake.emit('SIGNED_OUT', null));
    expect(auth().state).toEqual({ status: 'signed_out', sessionEnded: true });
  });

  it('does not mark the session as ended when the person signs out themselves', async () => {
    const fake = createFakeAuth(fakeSession());
    const { auth } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
    await act(async () => {
      expect(await auth().signOut()).toEqual({ ok: true });
    });
    expect(auth().state).toEqual({ status: 'signed_out', sessionEnded: false });
  });

  it('keeps the same state object when the same person is announced again', async () => {
    const fake = createFakeAuth(fakeSession());
    const { auth, latest } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
    const before = auth().state;
    const rendersBefore = latest.renders;
    // The real client re-announces the session on tab focus and token refresh.
    act(() => fake.emit('TOKEN_REFRESHED', fakeSession()));
    act(() => fake.emit('SIGNED_IN', fakeSession()));
    expect(auth().state).toBe(before);
    expect(latest.renders).toBe(rendersBefore);
  });

  it('updates when a different person signs in', async () => {
    const fake = createFakeAuth(fakeSession());
    const { auth } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
    act(() =>
      fake.emit('SIGNED_IN', fakeSession(fakeUser({ id: 'user-2', email: 'other@example.com' }))),
    );
    expect(auth().state).toMatchObject({ status: 'signed_in', user: { id: 'user-2' } });
  });

  it('stops listening when unmounted', async () => {
    const fake = createFakeAuth();
    const unsubscribe = vi.fn();
    fake.client.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { id: 'x', callback: () => {}, unsubscribe } },
    }));
    const { unmount } = mount(fake.client);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('AuthProvider actions', () => {
  it('signs in with the given credentials', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    await act(async () => {
      expect(await auth().signIn({ email: 'ada@example.com', password: 'secret-pass' })).toEqual({
        ok: true,
      });
    });
    expect(fake.client.signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'secret-pass',
    });
    expect(auth().state.status).toBe('signed_in');
  });

  it('turns sign-in failures into friendly messages', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    fake.client.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('invalid_credentials', 'Invalid login credentials'),
    });
    expect(await auth().signIn({ email: 'a@b.co', password: 'nope' })).toEqual({
      ok: false,
      message: 'Incorrect email or password.',
    });
    fake.client.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await auth().signIn({ email: 'a@b.co', password: 'nope' })).toEqual({
      ok: false,
      message: "Can't reach the server. Check your connection and try again.",
    });
  });

  it('asks for email confirmation when sign-up returns no session', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    expect(await auth().signUp({ email: 'new@example.com', password: 'secret-pass' })).toEqual({
      ok: true,
      needsEmailConfirmation: true,
    });
    expect(fake.client.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'secret-pass',
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
  });

  it('does not ask for confirmation when sign-up signs the person straight in', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    const session = fakeSession();
    fake.client.signUp.mockResolvedValueOnce({
      data: { user: session.user, session },
      error: null,
    });
    expect(await auth().signUp({ email: 'new@example.com', password: 'secret-pass' })).toEqual({
      ok: true,
      needsEmailConfirmation: false,
    });
  });

  it('reports a sign-up failure', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    fake.client.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('user_already_exists', 'User already registered'),
    });
    const result = await auth().signUp({ email: 'a@b.co', password: 'secret-pass' });
    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/already exists/) });
  });

  // Happens when the client could not clear its stored session (for example, storage is blocked).
  it('keeps the person signed in and says why when sign-out fails', async () => {
    const fake = createFakeAuth(fakeSession());
    const { auth } = mount(fake.client);
    await waitFor(() => expect(auth().state.status).toBe('signed_in'));
    fake.client.signOut.mockResolvedValueOnce({ error: new AuthRetryableFetchError('offline', 0) });
    expect(await auth().signOut()).toEqual({
      ok: false,
      message: "Can't reach the server. Check your connection and try again.",
    });
    expect(auth().state.status).toBe('signed_in');
    // A later, unrelated sign-out must still count as "session ended", not as a requested one.
    act(() => fake.emit('SIGNED_OUT', null));
    expect(auth().state).toEqual({ status: 'signed_out', sessionEnded: true });
  });

  it('sends the reset link to the reset page', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    expect(await auth().requestPasswordReset('ada@example.com')).toEqual({ ok: true });
    expect(fake.client.resetPasswordForEmail).toHaveBeenCalledWith('ada@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('answers the same for unknown emails so accounts cannot be discovered', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    fake.client.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError('User not found', 400, 'user_not_found'),
    });
    expect(await auth().requestPasswordReset('nobody@example.com')).toEqual({ ok: true });
  });

  it('still tells the person about rate limits and connection problems', async () => {
    const fake = createFakeAuth();
    const { auth } = mount(fake.client);
    fake.client.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'),
    });
    expect(await auth().requestPasswordReset('a@b.co')).toMatchObject({
      ok: false,
      message: expect.stringMatching(/too many attempts/i),
    });
    fake.client.resetPasswordForEmail.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await auth().requestPasswordReset('a@b.co')).toMatchObject({
      ok: false,
      message: expect.stringMatching(/can't reach the server/i),
    });
  });

  it('changes the password and explains rejections', async () => {
    const fake = createFakeAuth(fakeSession());
    const { auth } = mount(fake.client);
    expect(await auth().updatePassword('brand new pass')).toEqual({ ok: true });
    expect(fake.client.updateUser).toHaveBeenCalledWith({ password: 'brand new pass' });
    fake.client.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: authError('same_password', 'New password should be different from the old password.'),
    });
    expect(await auth().updatePassword('brand new pass')).toMatchObject({
      ok: false,
      message: expect.stringMatching(/different from your current one/),
    });
  });
});
