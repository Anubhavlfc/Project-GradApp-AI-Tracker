import { useAuth } from '@/features/auth/useAuth';

// Where the person's recommenders and letter requests are cached. Keyed by person, so one
// account's cache can never be shown to another. They live apart from the hooks so the
// applications feature can tidy these caches (when a program is deleted) without importing the
// screens.

function useUserId() {
  const { state } = useAuth();
  return state.status === 'signed_in' ? state.user.id : 'signed-out';
}

export function useRecommendersKey() {
  return ['recommenders', useUserId()] as const;
}

export function useRequestsKey() {
  return ['recommendation-requests', useUserId()] as const;
}
