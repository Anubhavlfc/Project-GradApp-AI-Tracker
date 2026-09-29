import { useAuth } from '@/features/auth/useAuth';

/** Where the person's recent activity is cached. Keyed by person, like every other list. */
export function useActivityKey() {
  const { state } = useAuth();
  return ['activity', state.status === 'signed_in' ? state.user.id : 'signed-out'] as const;
}
