import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useActivityApi } from './api-context';
import { useActivityKey } from './keys';

/** How many entries the dashboard shows. */
export const ACTIVITY_LIMIT = 10;

/**
 * The latest changes you made. Unlike the other lists this is never changed by the app itself (the
 * database writes it as a side effect of other changes), so it cannot be kept in step by editing
 * the cache. It is read again every time a screen that shows it opens instead.
 */
export function useRecentActivity() {
  const api = useActivityApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useActivityKey(),
    queryFn: () => api.recent(ACTIVITY_LIMIT),
    enabled: state.status === 'signed_in',
    staleTime: 0,
  });
}
