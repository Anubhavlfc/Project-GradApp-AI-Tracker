import { Link } from 'react-router';
import { ItemMenu } from '@/components/ui';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { TaskDue } from './TaskDue';
import { TaskPriorityBadge, TaskStatusPicker } from './TaskStatus';
import type { TaskStatus } from './kinds';
import type { TaskRow } from './types';

export type TaskActions = {
  onChangeStatus: (task: TaskRow, status: TaskStatus) => void;
  onEdit: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
};

type TaskItemProps = TaskActions & {
  task: TaskRow;
  /**
   * The program the task belongs to. On a program's own page this is not repeated; on the Tasks
   * page it is named, with a link. Null when tied to none.
   */
  application: ApplicationRecord | null;
  /** True on the Tasks page, where the program (or "no program") is named on every task. */
  showProgram: boolean;
  today: string;
};

/** One task: what to do, when by, how much it matters, and where it stands. */
export function TaskItem({
  task,
  application,
  showProgram,
  today,
  onChangeStatus,
  onEdit,
  onDelete,
}: TaskItemProps) {
  const program =
    task.application_id === null ? (
      'Not tied to a program'
    ) : application ? (
      <Link
        to={`/app/applications/${application.id}/tasks`}
        className="focus-ring rounded-sm hover:underline"
      >
        {applicationName(application)}
      </Link>
    ) : (
      'Unknown program'
    );
  const finished = task.status === 'complete';

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p
          className={
            finished
              ? 'break-words font-medium leading-6 text-fg-muted line-through'
              : 'break-words font-medium leading-6'
          }
        >
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
          <TaskPriorityBadge priority={task.priority} />
          {showProgram ? <span className="break-words">{program}</span> : null}
        </p>
        <TaskDue task={task} today={today} />
        {task.notes ? (
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">
            {task.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:-my-1.5">
        <TaskStatusPicker
          status={task.status}
          name={task.title}
          onChange={(status) => onChangeStatus(task, status)}
        />
        <ItemMenu
          subject={task.title}
          editLabel="Edit task"
          deleteLabel="Delete task…"
          onEdit={() => onEdit(task)}
          onDelete={() => onDelete(task)}
        />
      </div>
    </li>
  );
}
