import { Badge, StatusPicker } from '@/components/ui';
import {
  getTaskPriorityMeta,
  getTaskStatusMeta,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from './kinds';

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, tone } = getTaskStatusMeta(status);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/** "High", "Medium" or "Low": how much a task matters. */
export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  const { label, tone } = getTaskPriorityMeta(priority);
  return <Badge tone={tone}>{label}</Badge>;
}

type TaskStatusPickerProps = {
  status: TaskStatus;
  /** What the status belongs to, for screen readers: "Email Prof. Lee". */
  name: string;
  onChange: (status: TaskStatus) => void;
};

/** The status badge as a button: click it to move the task to another status. */
export function TaskStatusPicker({ status, name, onChange }: TaskStatusPickerProps) {
  return <StatusPicker value={status} options={TASK_STATUSES} subject={name} onChange={onChange} />;
}
