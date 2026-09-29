import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertPublicKey } from './publicKey';

export function createSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  if (!url || !anonKey) return null;
  assertPublicKey(anonKey);
  return createClient(url, anonKey, {
    // Every list is read through TanStack Query, which asks again once after a second when a read
    // fails. supabase-js would ask three more times, waiting 1, 2 and 4 seconds, so with the
    // connection down the person would look at a loading skeleton for about fifteen seconds
    // before seeing "Unable to load". One layer of retrying is enough.
    db: { retry: false },
  });
}

/** null when the environment variables are missing; the app then shows a setup message. */
export const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
