import { useMemo, useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { useToday } from '@/features/applications/useToday';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { DeleteTaskDialog } from '@/features/tasks/DeleteTaskDialog';
import { useSortedTasks, useTaskActions } from '@/features/tasks/hooks';
import {
  DEFAULT_TASK_FILTER,
  filterTasks,
  isDefaultFilter,
  NO_PROGRAM,
  parseTaskFilter,
  TASK_SHOW_OPTIONS,
  taskFilterParams,
  type TaskFilter,
  type TaskShow,
} from '@/features/tasks/logic';
import { TaskDialog, type TaskTarget } from '@/features/tasks/TaskDialog';
import { TaskItem } from '@/features/tasks/TaskItem';
import { TasksSummary } from '@/features/tasks/TasksSummary';
import type { TaskRow } from '@/features/tasks/types';
import { toDataError } from '@/lib/dataError';

function ListSkeleton() {
  return (
    <SkeletonRegion label="Loading tasks">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** What to say when the filters leave nothing to show, and the one thing to do about it. */
function emptyResult(filter: TaskFilter, inProgram: readonly TaskRow[]) {
  if (filter.show === 'open' && inProgram.length > 0) {
    return {
      title: 'Nothing left to do.',
      description: 'Every task here is complete.',
      action: 'Show all tasks',
      change: { show: 'all' as TaskShow },
    };
  }
  if (filter.show === 'complete' && inProgram.length > 0) {
    return {
      title: 'No completed tasks yet.',
      description: 'Tasks you finish will be listed here.',
      action: 'Show open tasks',
      change: { show: 'open' as TaskShow },
    };
  }
  return filter.program === NO_PROGRAM
    ? {
        title: 'No tasks outside your programs.',
        description: "Tasks that aren't tied to a program will be listed here.",
        action: 'Show all programs',
        change: { program: '' },
      }
    : {
        title: 'No tasks for this program yet.',
        description: 'Add one, or show the tasks for every program.',
        action: 'Show all programs',
        change: { program: '' },
      };
}

/** Everything left to do across your applications, soonest first. */
export function TasksPage() {
  const query = useSortedTasks();
  const applicationsQuery = useApplicationsQuery();
  const actions = useTaskActions();
  const [params, setParams] = useSearchParams();
  const today = useToday();

  const [editing, setEditing] = useState<TaskTarget | null>(null);
  const [toDelete, setToDelete] = useState<TaskRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const tasks = query.data;
  const applications = applicationsQuery.data;
  const applicationsById = useMemo(
    () => new Map<string, ApplicationRecord>((applications ?? []).map((item) => [item.id, item])),
    [applications],
  );
  const sortedApplications = useMemo(
    () =>
      [...(applications ?? [])].sort((a, b) =>
        applicationName(a).localeCompare(applicationName(b)),
      ),
    [applications],
  );

  // A link to a program that is gone (or never existed) shows everything rather than nothing.
  const asked = useMemo(() => parseTaskFilter(params), [params]);
  const filter: TaskFilter =
    asked.program === '' || asked.program === NO_PROGRAM || applicationsById.has(asked.program)
      ? asked
      : { ...asked, program: '' };

  function change(update: Partial<TaskFilter>) {
    setParams(taskFilterParams({ ...filter, ...update }), { replace: true });
  }

  const failed =
    (tasks === undefined && query.isError) ||
    (applications === undefined && applicationsQuery.isError);
  const loading = tasks === undefined || applications === undefined;

  function retry() {
    void query.refetch();
    void applicationsQuery.refetch();
  }

  function renderBody() {
    if (loading) {
      return failed ? (
        <Alert
          kind="danger"
          title="Unable to load tasks"
          action={
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error ?? applicationsQuery.error).message}
        </Alert>
      ) : (
        <ListSkeleton />
      );
    }

    if (tasks.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet."
          description="Write down what is left to do for your applications, like emailing a professor, ordering transcripts or booking a test, with a due date for each."
          action={
            <Button variant="primary" onClick={() => setEditing({ kind: 'new' })}>
              Add task
            </Button>
          }
        />
      );
    }

    const inProgram = filterTasks(tasks, { show: 'all', program: filter.program });
    const shown = filterTasks(tasks, filter);
    const empty = shown.length === 0 ? emptyResult(filter, inProgram) : null;

    return (
      <div className="space-y-4">
        {query.isError || applicationsQuery.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh tasks"
            action={
              <Button size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded.{' '}
            {toDataError(query.error ?? applicationsQuery.error).message}
          </Alert>
        ) : null}

        <TasksSummary tasks={inProgram} today={today} />

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-44">
            <Select
              aria-label="Show tasks"
              value={filter.show}
              onChange={(event) =>
                change({
                  show:
                    TASK_SHOW_OPTIONS.find((option) => option.value === event.target.value)
                      ?.value ?? DEFAULT_TASK_FILTER.show,
                })
              }
            >
              {TASK_SHOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-56">
            <Select
              aria-label="Filter by program"
              value={filter.program}
              onChange={(event) => change({ program: event.target.value })}
            >
              <option value="">All programs</option>
              <option value={NO_PROGRAM}>Not tied to a program</option>
              {sortedApplications.map((item) => (
                <option key={item.id} value={item.id}>
                  {applicationName(item)}
                </option>
              ))}
            </Select>
          </div>
          {!isDefaultFilter(filter) ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setParams(taskFilterParams(DEFAULT_TASK_FILTER), { replace: true })}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        {empty ? (
          <EmptyState
            icon={ListChecks}
            title={empty.title}
            description={empty.description}
            action={<Button onClick={() => change(empty.change)}>{empty.action}</Button>}
          />
        ) : (
          <Card>
            <ul aria-label="Tasks" className="divide-y divide-border">
              {shown.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  application={
                    task.application_id ? (applicationsById.get(task.application_id) ?? null) : null
                  }
                  showProgram
                  today={today}
                  onChangeStatus={actions.setStatus}
                  onEdit={(row) => setEditing({ kind: 'edit', item: row })}
                  onDelete={setToDelete}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  const newTask: TaskTarget = {
    kind: 'new',
    initialApplicationId: applicationsById.has(filter.program) ? filter.program : undefined,
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Everything left to do for your applications, soonest first."
        actions={
          !loading && tasks.length > 0 ? (
            <Button variant="primary" onClick={() => setEditing(newTask)}>
              <Plus aria-hidden="true" className="size-4" />
              Add task
            </Button>
          ) : undefined
        }
      />

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
