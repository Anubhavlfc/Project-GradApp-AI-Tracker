import { useAuth } from '@/features/auth/useAuth';

/**
 * Where the person's documents are cached. Keyed by person, so one account's cache can never be
 * shown to another.
 */
export function useDocumentsKey() {
  const { state } = useAuth();
  return ['documents', state.status === 'signed_in' ? state.user.id : 'signed-out'] as const;
}
