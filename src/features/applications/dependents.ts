import { useFundingKey } from '@/features/funding/keys';
import { useRequestsKey } from '@/features/recommendations/keys';
import { useRequirementsKey } from '@/features/requirements/keys';
import { useTasksKey } from '@/features/tasks/keys';

/**
 * The cached lists whose rows belong to a program. The database deletes those rows along with the
 * program, so the cache drops them too. A feature that hangs rows off a program adds its key here.
 */
export function useDependentKeys() {
  return [useRequirementsKey(), useRequestsKey(), useFundingKey(), useTasksKey()];
}
