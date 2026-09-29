import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { toneText } from '@/components/ui/tone';
import { useToday } from '@/features/applications/useToday';
import type { ApplicationRecord } from '@/features/applications/types';
import { cn } from '@/lib/cn';
import { toDataError } from '@/lib/dataError';
import { useApplicationTasks } from './hooks';
import { isOpenTask } from './kinds';
import { summarizeTasks, taskDue } from './logic';

/** A program's tasks at a glance, on the Overview tab: what is open, and what to do next. */
export function TasksOverviewCard({ record }: { record: ApplicationRecord }) {
  const query = useApplicationTasks(record.id);
  const tasks = query.data;
  const to = `/app/applications/${record.id}/tasks`;
  const today = useToday();

  function body() {
    if (tasks === undefined) {
      return query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Unable to load tasks</p>
            <p className="text-fg-muted">{toDataError(query.error).message}</p>
          </div>
          <Button size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <SkeletonRegion label="Loading tasks">
          <Skeleton className="h-10 w-full" />
        </SkeletonRegion>
      );
    }
    if (tasks.length === 0) return <p className="text-fg-muted">No tasks yet.</p>;

    const progress = summarizeTasks(tasks, today);
    // The list is already in the order to deal with tasks, so the first open one is next.
    const next = tasks.find((task) => isOpenTask(task.status));
    const nextDue = next ? taskDue(next, today) : null;
    return (
      <div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium tabular-nums">
            {progress.complete} of {progress.total} complete
          </span>
          {progress.overdue > 0 ? <Badge tone="red">{progress.overdue} overdue</Badge> : null}
        </p>
        {next ? (
          <p className="mt-1.5 text-xs text-fg-muted">
            Next: <span className="break-words text-fg">{next.title}</span>
            {nextDue?.text ? (
              <span className={cn('ml-2 font-medium', toneText[nextDue.tone])}>{nextDue.text}</span>
            ) : null}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-fg-muted">Every task is complete.</p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Tasks"
        action={
          tasks === undefined ? undefined : (
            <ButtonLink to={to} size="sm">
              {tasks.length === 0 ? 'Add a task' : 'View tasks'}
            </ButtonLink>
          )
        }
      />
      <CardBody>{body()}</CardBody>
    </Card>
  );
}
