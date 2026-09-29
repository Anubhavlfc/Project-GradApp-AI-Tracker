import { useAuth } from '@/features/auth/useAuth';

/**
 * Where the person's tasks are cached. Keyed by person, so one account's cache can never be shown
 * to another. Lives apart from the hooks so the applications feature can tidy this cache (when a
 * program is deleted) without importing the task screens.
 */
export function useTasksKey() {
  const { state } = useAuth();
  return ['tasks', state.status === 'signed_in' ? state.user.id : 'signed-out'] as const;
}
