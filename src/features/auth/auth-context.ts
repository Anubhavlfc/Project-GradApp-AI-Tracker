import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';

export type AuthState =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | {
      status: 'signed_out';
      sessionEnded: boolean;
      /** They chose to sign out, so where they were (and what they searched for) shouldn't follow the next sign-in. */
      leftOnPurpose?: boolean;
      /** They just deleted their account: the sign-in page says so. */
      accountDeleted?: boolean;
    }
  | { status: 'signed_in'; user: User };

export type ActionResult = { ok: true } | { ok: false; message: string };
export type SignUpResult =
  { ok: true; needsEmailConfirmation: boolean } | { ok: false; message: string };

export type AuthContextValue = {
  state: AuthState;
  signIn: (input: { email: string; password: string }) => Promise<ActionResult>;
  signUp: (input: { email: string; password: string }) => Promise<SignUpResult>;
  signOut: () => Promise<ActionResult>;
  /** Always resolves ok for unknown emails, so the form can't be used to discover accounts. */
  requestPasswordReset: (email: string) => Promise<ActionResult>;
  updatePassword: (password: string) => Promise<ActionResult>;
  /**
   * For after the account has been deleted: forgets the sign-in on this device, without asking the
   * server (the account it would sign out no longer exists), and leaves a note for the sign-in page.
   */
  leaveDeletedAccount: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
