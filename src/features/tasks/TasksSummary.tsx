import { CircleCheck } from 'lucide-react';
import { Card, CardBody, CardHeader, ProgressBar } from '@/components/ui';
import { DUE_SOON_DAYS, summarizeTasks } from './logic';
import type { TaskRow } from './types';

/** How many tasks are done, as a bar and in words. Nothing until there is a task. */
export function TasksSummary({ tasks, today }: { tasks: readonly TaskRow[]; today: string }) {
  const progress = summarizeTasks(tasks, today);
  const { total, complete, percent } = progress;
  if (percent === null) return null;
  return (
    <Card>
      <CardHeader title="Tasks at a glance" />
      <CardBody>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {complete} of {total}
            </span>{' '}
            <span className="text-fg-muted">{total === 1 ? 'task' : 'tasks'} complete</span>
          </p>
          <p className="text-lg font-semibold tabular-nums">{percent}%</p>
        </div>
        <ProgressBar className="mt-2" value={percent} label="Tasks completed" />
        {complete === total ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-tone-green-fg">
            <CircleCheck aria-hidden="true" className="size-3.5" />
            Every task is complete.
          </p>
        ) : (
          <p className="mt-2 text-xs text-fg-muted">
            {progress.open} open
            {progress.overdue > 0 ? (
              <>
                {' · '}
                <span className="font-medium text-tone-red-fg">{progress.overdue} overdue</span>
              </>
            ) : null}
            {progress.dueSoon > 0
              ? ` · ${progress.dueSoon} due in the next ${DUE_SOON_DAYS} days`
              : null}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
