import { useMemo } from 'react';
import { useToday } from '@/features/applications/useToday';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { useFundingQuery } from '@/features/funding/hooks';
import { useRecommendersQuery, useRequestsQuery } from '@/features/recommendations/hooks';
import { useRequirementsQuery } from '@/features/requirements/hooks';
import { useTasksQuery } from '@/features/tasks/hooks';
import { collectDeadlines, type DeadlineItem } from './logic';

// The deadlines list reads the same cached lists as every other screen (programs, checklists,
// letters, funding, tasks), so a change made anywhere shows up here at once and it costs no
// requests of its own.

/** Something the person should know about a list that is not quite whole. */
export type DeadlineProblem =
  /** These lists could not be loaded at all, so their deadlines are not in the list. */
  | { kind: 'missing'; lists: string[]; error: unknown }
  /** Every list loaded once, but one could not be refreshed, so what is shown may be a little old. */
  | { kind: 'stale'; error: unknown };

export type Deadlines =
  | { status: 'loading' }
  /** The programs could not be loaded, so there is nothing to build a list from. */
  | { status: 'failed'; error: unknown; retry: () => void }
  | {
      status: 'ready';
      items: DeadlineItem[];
      /** Missing lists are reported before lists that are only old. */
      problem: DeadlineProblem | null;
      retry: () => void;
    };

type ListState = { data: unknown; isError: boolean; error: unknown; refetch: () => unknown };

const failedWithoutData = (list: ListState) => list.data === undefined && list.isError;
const stillLoading = (list: ListState) => list.data === undefined && !list.isError;

/**
 * Every date across your programs: application deadlines, checklist items, letters, funding and
 * tasks. A list that fails to load only takes its own deadlines away, and says so.
 */
export function useDeadlines(): Deadlines {
  const applications = useApplicationsQuery();
  const requirements = useRequirementsQuery();
  const recommenders = useRecommendersQuery();
  const requests = useRequestsQuery();
  const funding = useFundingQuery();
  const tasks = useTasksQuery();
  const today = useToday();

  const applicationRows = applications.data;
  const requirementRows = requirements.data;
  const recommenderRows = recommenders.data;
  const requestRows = requests.data;
  const fundingRows = funding.data;
  const taskRows = tasks.data;
  const items = useMemo(
    () =>
      applicationRows
        ? collectDeadlines({
            applications: applicationRows,
            requirements: requirementRows,
            recommenders: recommenderRows,
            requests: requestRows,
            funding: fundingRows,
            tasks: taskRows,
            today,
          })
        : [],
    [applicationRows, requirementRows, recommenderRows, requestRows, fundingRows, taskRows, today],
  );

  const lists: ListState[] = [applications, requirements, recommenders, requests, funding, tasks];
  // Asks again only for the lists that failed, and only when there is something to ask again.
  const retry = () => {
    for (const list of lists) if (list.isError) void list.refetch();
  };

  if (failedWithoutData(applications)) {
    return { status: 'failed', error: applications.error, retry };
  }
  if (lists.some(stillLoading)) return { status: 'loading' };

  // What each source of deadlines is called to the person, and the lists it is built from.
  const sources: { name: string; lists: ListState[] }[] = [
    { name: 'checklist items', lists: [requirements] },
    { name: 'recommendation letters', lists: [recommenders, requests] },
    { name: 'funding', lists: [funding] },
    { name: 'tasks', lists: [tasks] },
  ];
  const missing = sources.filter((source) => source.lists.some(failedWithoutData));
  const old = lists.find((list) => list.isError);

  let problem: DeadlineProblem | null = null;
  if (missing.length > 0) {
    problem = {
      kind: 'missing',
      lists: missing.map((source) => source.name),
      error: missing[0]?.lists.find(failedWithoutData)?.error,
    };
  } else if (old) {
    problem = { kind: 'stale', error: old.error };
  }
  return { status: 'ready', items, problem, retry };
}
