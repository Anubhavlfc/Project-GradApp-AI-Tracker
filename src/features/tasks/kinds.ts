import type { Tone } from '@/components/ui/tone';

// What a task can be, and where it stands. The values are stored in the database (enums
// `task_status` and `task_priority`), so keep them in sync with supabase/migrations.

// The order here is the order of a task's life.
export const TASK_STATUSES = [
  { value: 'todo', label: 'To Do', tone: 'neutral' },
  { value: 'in_progress', label: 'In Progress', tone: 'amber' },
  { value: 'complete', label: 'Complete', tone: 'green' },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export type TaskStatus = (typeof TASK_STATUSES)[number]['value'];
export const TASK_STATUS_VALUES = TASK_STATUSES.map((status) => status.value);

export function getTaskStatusMeta(status: TaskStatus) {
  const meta = TASK_STATUSES.find((item) => item.value === status);
  if (!meta) throw new Error(`Unknown task status: ${status}`);
  return meta;
}

/** Still to do: not started, or started and not finished. */
export function isOpenTask(status: TaskStatus): boolean {
  return status !== 'complete';
}

// Lowest to highest, the order of the database enum.
export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low', tone: 'neutral' },
  { value: 'medium', label: 'Medium', tone: 'amber' },
  { value: 'high', label: 'High', tone: 'red' },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export type TaskPriority = (typeof TASK_PRIORITIES)[number]['value'];
export const TASK_PRIORITY_VALUES = TASK_PRIORITIES.map((priority) => priority.value);

export function getTaskPriorityMeta(priority: TaskPriority) {
  const meta = TASK_PRIORITIES.find((item) => item.value === priority);
  if (!meta) throw new Error(`Unknown task priority: ${priority}`);
  return meta;
}

/** 2 for high, 1 for medium, 0 for low: bigger means more urgent. */
export function priorityRank(priority: TaskPriority): number {
  return TASK_PRIORITIES.findIndex((item) => item.value === priority);
}
