import { AuthApiError, type AuthChangeEvent, type Session, type User } from '@supabase/supabase-js';
import type { AuthClient } from '@/features/auth/AuthProvider';

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

export function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function fakeSession(user: User = fakeUser()): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
}

export function authError(code: string, message = code, status = 400) {
  return new AuthApiError(message, status, code);
}

/**
 * An in-memory stand-in for supabase.auth. Each method is a mock with sensible default behaviour
 * (successful, and announcing the change to listeners like the real client does), so a test only
 * overrides what it cares about.
 */
export function createFakeAuth(initialSession: Session | null = null) {
  let session = initialSession;
  const listeners = new Set<Listener>();

  function emit(event: AuthChangeEvent, next: Session | null) {
    session = next;
    for (const listener of [...listeners]) listener(event, next);
  }

  const client = {
    getSession: vi.fn<AuthClient['getSession']>(async () =>
      session ? { data: { session }, error: null } : { data: { session: null }, error: null },
    ),

    onAuthStateChange: vi.fn((listener: Listener) => {
      listeners.add(listener);
      // Like the real client, announce the stored session shortly after subscribing.
      queueMicrotask(() => {
        if (listeners.has(listener)) listener('INITIAL_SESSION', session);
      });
      return {
        data: {
          subscription: {
            id: 'fake-subscription',
            callback: listener,
            unsubscribe: () => void listeners.delete(listener),
          },
        },
      };
    }),

    signInWithPassword: vi.fn<AuthClient['signInWithPassword']>(async () => {
      const next = fakeSession();
      emit('SIGNED_IN', next);
      return { data: { user: next.user, session: next }, error: null };
    }),

    signUp: vi.fn<AuthClient['signUp']>(async () => ({
      // Email confirmation on: an account exists but there is no session yet.
      data: { user: fakeUser(), session: null },
      error: null,
    })),

    signOut: vi.fn<AuthClient['signOut']>(async () => {
      emit('SIGNED_OUT', null);
      return { error: null };
    }),

    resetPasswordForEmail: vi.fn<AuthClient['resetPasswordForEmail']>(async () => ({
      data: {},
      error: null,
    })),

    updateUser: vi.fn<AuthClient['updateUser']>(async () => ({
      data: { user: session?.user ?? fakeUser() },
      error: null,
    })),
  } satisfies AuthClient;

  return {
    client,
    /** Simulate something happening outside the app, e.g. the session expiring. */
    emit,
    get session() {
      return session;
    },
  };
}
