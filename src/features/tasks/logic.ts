import { describeOpenDeadline, type DeadlineInfo } from '@/features/applications/dates';
import { percentOf } from '@/features/requirements/progress';
import { isOpenTask, priorityRank } from './kinds';
import type { TaskRow } from './types';

// The small rules behind the task screens: what a due date means, how far along the tasks are,
// which ones a filter shows, and in what order they come. Pure functions: no screens, no database.

/**
 * What a task's due date means right now. It only matters while the task is open: a task that is
 * complete is history and never shown as overdue. Unlike an application deadline, the status of
 * the program does not close it: "send a thank-you note" is still worth doing after you submit.
 */
export function taskDue(task: Pick<TaskRow, 'due_date' | 'status'>, today: string): DeadlineInfo {
  if (!task.due_date) return { state: 'none', days: null, text: null, tone: 'neutral' };
  const open = describeOpenDeadline(task.due_date, today);
  if (open.state === 'none') return open;
  return isOpenTask(task.status)
    ? open
    : { state: 'closed', days: open.days, text: null, tone: 'neutral' };
}

/** How many days ahead counts as "due soon" in the summaries. */
export const DUE_SOON_DAYS = 7;

export type TaskProgress = {
  total: number;
  complete: number;
  /** Not complete: To Do or In Progress. */
  open: number;
  inProgress: number;
  /** Open, and past its due date. */
  overdue: number;
  /** Open, and due today or within the next week (not counting overdue ones). */
  dueSoon: number;
  /** complete / total as a whole percent; null while there are no tasks. */
  percent: number | null;
};

export function summarizeTasks(
  rows: readonly Pick<TaskRow, 'due_date' | 'status'>[],
  today: string,
): TaskProgress {
  let complete = 0;
  let inProgress = 0;
  let overdue = 0;
  let dueSoon = 0;
  for (const row of rows) {
    if (row.status === 'complete') {
      complete += 1;
      continue;
    }
    if (row.status === 'in_progress') inProgress += 1;
    const days = taskDue(row, today).days;
    if (days === null) continue;
    if (days < 0) overdue += 1;
    else if (days <= DUE_SOON_DAYS) dueSoon += 1;
  }
  return {
    total: rows.length,
    complete,
    open: rows.length - complete,
    inProgress,
    overdue,
    dueSoon,
    percent: percentOf(complete, rows.length),
  };
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/**
 * The order to deal with tasks in. Open ones first: the soonest due date first (no date last),
 * then the most important, then by title. Finished ones after them, the most recently finished
 * first.
 */
export function sortTasks(rows: readonly TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => {
    const aOpen = isOpenTask(a.status);
    if (aOpen !== isOpenTask(b.status)) return aOpen ? -1 : 1;
    if (aOpen) {
      if (a.due_date !== b.due_date) {
        if (a.due_date === null) return 1;
        if (b.due_date === null) return -1;
        return a.due_date < b.due_date ? -1 : 1;
      }
      const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
      if (byPriority !== 0) return byPriority;
    } else if (a.completed_at !== b.completed_at) {
      if (a.completed_at === null) return 1;
      if (b.completed_at === null) return -1;
      return a.completed_at < b.completed_at ? 1 : -1;
    }
    return (
      collator.compare(a.title, b.title) ||
      collator.compare(a.created_at, b.created_at) ||
      collator.compare(a.id, b.id)
    );
  });
}

/** Which tasks to list: open ones (the default), finished ones, or everything. */
export type TaskShow = 'open' | 'complete' | 'all';

export const TASK_SHOW_OPTIONS: readonly { value: TaskShow; label: string }[] = [
  { value: 'open', label: 'Open tasks' },
  { value: 'complete', label: 'Completed tasks' },
  { value: 'all', label: 'All tasks' },
];

/** The program filter value for "tasks that belong to no program". */
export const NO_PROGRAM = 'none';

export type TaskFilter = {
  show: TaskShow;
  /** '' for every program, NO_PROGRAM for tasks tied to none, otherwise a program's id. */
  program: string;
};

export const DEFAULT_TASK_FILTER: TaskFilter = { show: 'open', program: '' };

/** Reads a filter from the page address; anything unrecognised means "the default". */
export function parseTaskFilter(params: URLSearchParams): TaskFilter {
  const show = params.get('show');
  return {
    show: show === 'complete' || show === 'all' ? show : 'open',
    program: params.get('program')?.trim() ?? '',
  };
}

/** The page address parameters for a filter; the defaults are left out. */
export function taskFilterParams(filter: TaskFilter): Record<string, string> {
  return {
    ...(filter.show !== 'open' ? { show: filter.show } : {}),
    ...(filter.program !== '' ? { program: filter.program } : {}),
  };
}

export function isDefaultFilter(filter: TaskFilter): boolean {
  return filter.show === DEFAULT_TASK_FILTER.show && filter.program === DEFAULT_TASK_FILTER.program;
}

export function filterTasks(rows: readonly TaskRow[], filter: TaskFilter): TaskRow[] {
  return rows.filter((row) => {
    if (filter.show === 'open' && !isOpenTask(row.status)) return false;
    if (filter.show === 'complete' && isOpenTask(row.status)) return false;
    if (filter.program === '') return true;
    if (filter.program === NO_PROGRAM) return row.application_id === null;
    return row.application_id === filter.program;
  });
}
