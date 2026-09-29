import { toneText } from '@/components/ui/tone';
import { formatDate } from '@/features/applications/dates';
import { cn } from '@/lib/cn';
import { taskDue } from './logic';
import type { TaskRow } from './types';

type TaskDueProps = {
  task: Pick<TaskRow, 'due_date' | 'status'>;
  today: string;
};

/** "Due Dec 1, 2026  In 10 days": when a task is due, and how far away that is while it is open. */
export function TaskDue({ task, today }: TaskDueProps) {
  if (!task.due_date) return null;
  const due = taskDue(task, today);
  return (
    <p className="text-xs text-fg-muted">
      Due <span className="tabular-nums">{formatDate(task.due_date)}</span>
      {due.text ? (
        <span className={cn('ml-2 font-medium', toneText[due.tone])}>{due.text}</span>
      ) : null}
    </p>
  );
}
