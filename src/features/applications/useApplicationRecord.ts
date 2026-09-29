import { useOutletContext } from 'react-router';
import type { ApplicationRecord } from './types';

/** The program shown on the current details page. Only valid inside <ApplicationLayout>. */
export function useApplicationRecord(): ApplicationRecord {
  return useOutletContext<ApplicationRecord>();
}
