import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabase';
import {
  AuthContext,
  type ActionResult,
  type AuthContextValue,
  type AuthState,
  type SignUpResult,
} from './auth-context';
import { friendlyAuthMessage, isActionableAuthError } from './errors';

/** The slice of the Supabase auth client we use, so tests can supply a fake. */
export type AuthClient = Pick<
  SupabaseClient['auth'],
  | 'getSession'
  | 'onAuthStateChange'
  | 'signInWithPassword'
  | 'signUp'
  | 'signOut'
  | 'resetPasswordForEmail'
  | 'updateUser'
>;

function stateFromSession(session: Session | null): AuthState {
  return session
    ? { status: 'signed_in', user: session.user }
    : { status: 'signed_out', sessionEnded: false };
}

/**
 * The client re-announces the same session on tab focus and token refresh. Keeping the previous
 * state when nothing about the person changed avoids re-rendering (and later re-fetching) the app.
 */
function keepIfSameUser(previous: AuthState, next: AuthState): AuthState {
  return previous.status === 'signed_in' &&
    next.status === 'signed_in' &&
    previous.user.id === next.user.id &&
    previous.user.updated_at === next.user.updated_at
    ? previous
    : next;
}

type AuthProviderProps = { children: ReactNode; client?: AuthClient | null };

export function AuthProvider({ children, client = supabase?.auth ?? null }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(
    client ? { status: 'loading' } : { status: 'unconfigured' },
  );
  // Distinguishes "I clicked sign out" from "my session ended" (expired or signed out elsewhere).
  const signingOut = useRef(false);

  useEffect(() => {
    if (!client) return;
    let active = true;

    const { data } = client.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT') {
        const requested = signingOut.current;
        signingOut.current = false;
        setState((previous) => ({
          status: 'signed_out',
          sessionEnded: previous.status === 'signed_in' && !requested,
          ...(requested ? { leftOnPurpose: true } : {}),
        }));
        return;
      }
      setState((previous) => keepIfSameUser(previous, stateFromSession(session)));
    });

    // Fallback for clients that do not emit an initial event.
    client
      .getSession()
      .then(({ data: { session } }) => {
        if (active)
          setState((previous) =>
            previous.status === 'loading' ? stateFromSession(session) : previous,
          );
      })
      .catch((error: unknown) => {
        logError('auth.getSession', error);
        if (active)
          setState((previous) =>
            previous.status === 'loading' ? stateFromSession(null) : previous,
          );
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthContextValue>(() => {
    const unavailable = { ok: false, message: 'Sign-in is not set up yet.' } as const;

    async function signIn(input: { email: string; password: string }): Promise<ActionResult> {
      if (!client) return unavailable;
      try {
        const { error } = await client.signInWithPassword(input);
        if (error) return { ok: false, message: friendlyAuthMessage(error) };
        return { ok: true };
      } catch (error) {
        logError('auth.signIn', error);
        return { ok: false, message: friendlyAuthMessage(error) };
      }
    }

    async function signUp(input: { email: string; password: string }): Promise<SignUpResult> {
      if (!client) return unavailable;
      try {
        const { data, error } = await client.signUp({
          ...input,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) return { ok: false, message: friendlyAuthMessage(error) };
        // With email confirmation on, no session is returned until the link is clicked.
        return { ok: true, needsEmailConfirmation: !data.session };
      } catch (error) {
        logError('auth.signUp', error);
        return { ok: false, message: friendlyAuthMessage(error) };
      }
    }

    async function signOut(): Promise<ActionResult> {
      if (!client) return unavailable;
      signingOut.current = true;
      try {
        const { error } = await client.signOut();
        if (error) {
          signingOut.current = false;
          return { ok: false, message: friendlyAuthMessage(error) };
        }
        return { ok: true };
      } catch (error) {
        signingOut.current = false;
        logError('auth.signOut', error);
        return { ok: false, message: friendlyAuthMessage(error) };
      }
    }

    async function requestPasswordReset(email: string): Promise<ActionResult> {
      if (!client) return unavailable;
      try {
        const { error } = await client.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (!error) return { ok: true };
        logError('auth.requestPasswordReset', error);
        // Report only what the person can act on (slow down, check the connection). Anything
        // else looks like success so the form can't be used to discover which emails have accounts.
        return isActionableAuthError(error)
          ? { ok: false, message: friendlyAuthMessage(error) }
          : { ok: true };
      } catch (error) {
        logError('auth.requestPasswordReset', error);
        return { ok: false, message: friendlyAuthMessage(error) };
      }
    }

    async function updatePassword(password: string): Promise<ActionResult> {
      if (!client) return unavailable;
      try {
        const { error } = await client.updateUser({ password });
        if (error) return { ok: false, message: friendlyAuthMessage(error) };
        return { ok: true };
      } catch (error) {
        logError('auth.updatePassword', error);
        return { ok: false, message: friendlyAuthMessage(error) };
      }
    }

    return { state, signIn, signUp, signOut, requestPasswordReset, updatePassword };
  }, [client, state]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
