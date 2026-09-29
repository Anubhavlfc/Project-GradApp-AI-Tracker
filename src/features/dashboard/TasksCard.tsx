import { CircleCheck } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { useToday } from '@/features/applications/useToday';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { useTasksQuery } from '@/features/tasks/hooks';
import { isOpenTask } from '@/features/tasks/kinds';
import { DUE_SOON_DAYS, sortTasks, summarizeTasks, taskDue } from '@/features/tasks/logic';
import { CompactRow } from './CompactRow';
import { DashboardCard } from './DashboardCard';
import { DueLabel } from './DueLabel';
import { gather } from './gather';

/** How many tasks the dashboard lists; the Tasks page has the rest. */
export const TASKS_SHOWN = 5;

/** What is open on your to-do list, and the tasks to do next. */
export function TasksCard() {
  const tasks = useTasksQuery();
  const applications = useApplicationsQuery();
  const today = useToday();
  return (
    <DashboardCard
      title="Tasks"
      description="Your to-do list, most pressing first."
      action={
        <ButtonLink to="/app/tasks" size="sm">
          View all
        </ButtonLink>
      }
      state={gather([tasks, applications])}
      failedTitle="Unable to load tasks"
    >
      {() => {
        if (!tasks.data || !applications.data) return null;
        const programs = new Map(applications.data.map((record) => [record.id, record]));
        if (tasks.data.length === 0) {
          return (
            <p className="p-4 text-fg-muted">
              No tasks yet. Add one for a program, or for anything else you need to do.
            </p>
          );
        }

        const progress = summarizeTasks(tasks.data, today);
        const next = sortTasks(tasks.data)
          .filter((task) => isOpenTask(task.status))
          .slice(0, TASKS_SHOWN);
        return (
          <>
            <div className="border-b border-border p-4">
              {progress.open === 0 ? (
                <p className="flex items-center gap-1.5 font-medium text-tone-green-fg">
                  <CircleCheck aria-hidden="true" className="size-4" />
                  Every task is complete.
                </p>
              ) : (
                <p className="text-fg-muted">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
                    {progress.open}
                  </span>{' '}
                  open
                  {progress.overdue > 0 ? (
                    <>
                      {' · '}
                      <span className="font-medium text-tone-red-fg">
                        {progress.overdue} overdue
                      </span>
                    </>
                  ) : null}
                  {progress.dueSoon > 0
                    ? ` · ${progress.dueSoon} due in the next ${DUE_SOON_DAYS} days`
                    : null}
                </p>
              )}
            </div>
            {next.length > 0 ? (
              <ul aria-label="Next tasks" className="divide-y divide-border">
                {next.map((task) => {
                  const record = task.application_id ? programs.get(task.application_id) : null;
                  return (
                    <CompactRow
                      key={task.id}
                      title={task.title}
                      href={record ? `/app/applications/${record.id}/tasks` : '/app/tasks'}
                      context={record ? applicationName(record) : null}
                      trailing={<DueLabel date={task.due_date} info={taskDue(task, today)} />}
                    />
                  );
                })}
              </ul>
            ) : null}
          </>
        );
      }}
    </DashboardCard>
  );
}
