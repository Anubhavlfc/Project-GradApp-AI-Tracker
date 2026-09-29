import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertPublicKey } from './publicKey';

export function createSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  if (!url || !anonKey) return null;
  assertPublicKey(anonKey);
  return createClient(url, anonKey);
}

/** null when the environment variables are missing; the app then shows a setup message. */
export const supabase = createSupabaseClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
