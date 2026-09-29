/**
 * Anything named VITE_* is copied into the JavaScript every visitor downloads, so the Supabase
 * key configured here must be the public one. A service_role/secret key would let any visitor
 * read and change every user's data.
 *
 * No imports on purpose: vite.config.ts runs this at build time too.
 */
export function assertPublicKey(key: string): void {
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is a secret (service_role) key. Use the public anon/publishable key instead, and rotate the secret one because it may have been exposed.',
    );
  }
}

function jwtRole(key: string): string | undefined {
  const payload = key.split('.')[1];
  if (!payload) return undefined;
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof claims === 'object' && claims !== null && 'role' in claims) {
      return typeof claims.role === 'string' ? claims.role : undefined;
    }
  } catch {
    // Not a JWT (for example a publishable key): nothing more to check.
  }
  return undefined;
}
