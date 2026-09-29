import { useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton, SkeletonRegion } from '@/components/ui';
import { useToday } from '@/features/applications/useToday';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { DeleteTaskDialog } from '@/features/tasks/DeleteTaskDialog';
import { useApplicationTasks, useTaskActions } from '@/features/tasks/hooks';
import { TaskDialog, type TaskTarget } from '@/features/tasks/TaskDialog';
import { TaskItem } from '@/features/tasks/TaskItem';
import { TasksSummary } from '@/features/tasks/TasksSummary';
import type { TaskRow } from '@/features/tasks/types';
import { toDataError } from '@/lib/dataError';

function TasksSkeleton() {
  return (
    <SkeletonRegion label="Loading tasks">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** A program's tasks: what is left to do for it, and when. */
export function TasksTab() {
  const record = useApplicationRecord();
  const query = useApplicationTasks(record.id);
  const actions = useTaskActions();
  const today = useToday();

  const [editing, setEditing] = useState<TaskTarget | null>(null);
  const [toDelete, setToDelete] = useState<TaskRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = () => setEditing({ kind: 'new', applicationId: record.id });
  const tasks = query.data;

  function renderBody() {
    if (tasks === undefined) {
      return query.isError ? (
        <Alert
          kind="danger"
          title="Unable to load tasks"
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error).message}
        </Alert>
      ) : (
        <TasksSkeleton />
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No tasks for this program yet."
          description="Write down what is left to do for this program, like emailing a professor, ordering transcripts or booking a test, with a due date for each."
          action={
            <Button variant="primary" onClick={add}>
              Add task
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {query.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh tasks"
            action={
              <Button size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded. {toDataError(query.error).message}
          </Alert>
        ) : null}

        <TasksSummary tasks={tasks} today={today} />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Tasks for this program</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                What is left to do, soonest first. Finished tasks are at the end.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={add}>
              <Plus aria-hidden="true" className="size-4" />
              Add task
            </Button>
          </div>
          <ul aria-label="Tasks for this program" className="divide-y divide-border">
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                application={record}
                showProgram={false}
                today={today}
                onChangeStatus={actions.setStatus}
                onEdit={(row) => setEditing({ kind: 'edit', item: row })}
                onDelete={setToDelete}
              />
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {notice ? (
          <Alert
            kind="success"
            title={notice}
            action={
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                Dismiss
              </Button>
            }
          />
        ) : null}

        {actions.error ? (
          <Alert
            kind="danger"
            title="Couldn't update that task"
            action={
              <Button size="sm" variant="ghost" onClick={actions.clearError}>
                Dismiss
              </Button>
            }
          >
            {actions.error}
          </Alert>
        ) : null}

        {renderBody()}
      </div>

      <TaskDialog target={editing} onClose={() => setEditing(null)} onSaved={setNotice} />
      <DeleteTaskDialog
        task={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={(task) => {
          setToDelete(null);
          setNotice(`Deleted ${task.title}.`);
        }}
      />
    </>
  );
}
