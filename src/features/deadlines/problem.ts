import { toDataError } from '@/lib/dataError';
import type { DeadlineProblem } from './hooks';

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** What to tell the person about a deadlines list that is not quite whole. */
export function describeProblem(problem: DeadlineProblem): { title: string; message: string } {
  const reason = toDataError(problem.error).message;
  return problem.kind === 'missing'
    ? {
        title: 'Some deadlines are missing',
        message: `Couldn’t load your ${listFormat.format(problem.lists)}, so their deadlines are not listed. ${reason}`,
      }
    : {
        title: 'Unable to refresh deadlines',
        message: `Showing the last list that loaded. ${reason}`,
      };
}
