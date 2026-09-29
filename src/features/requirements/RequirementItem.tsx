import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Badge, IconButton, Menu, MenuItem } from '@/components/ui';
import { toneText } from '@/components/ui/tone';
import { formatDate } from '@/features/applications/dates';
import type { ApplicationStatus } from '@/features/applications/status';
import { cn } from '@/lib/cn';
import { isDone, type RequirementStatus } from './kinds';
import { requirementDue, requirementSubtitle, requirementTitle } from './progress';
import { RequirementStatusIcon, RequirementStatusMenu } from './RequirementStatus';
import type { RequirementRow } from './types';

export type RequirementItemActions = {
  onChangeStatus: (row: RequirementRow, status: RequirementStatus) => void;
  onEdit: (row: RequirementRow) => void;
  onDelete: (row: RequirementRow) => void;
};

type RequirementItemProps = RequirementItemActions & {
  row: RequirementRow;
  /** The program's own status: once it is sent or decided, open items are no longer "overdue". */
  applicationStatus: ApplicationStatus;
  today: string;
};

/** The "..." menu on an item: edit or delete it. */
function ItemActions({
  row,
  title,
  onEdit,
  onDelete,
}: Pick<RequirementItemProps, 'row' | 'onEdit' | 'onDelete'> & { title: string }) {
  const label = `Actions for ${title}`;
  return (
    <Menu
      label={label}
      trigger={(props) => (
        <IconButton label={label} {...props}>
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </IconButton>
      )}
    >
      <MenuItem
        icon={<Pencil aria-hidden="true" className="size-4" />}
        onSelect={() => onEdit(row)}
      >
        Edit
      </MenuItem>
      <MenuItem
        destructive
        icon={<Trash2 aria-hidden="true" className="size-4" />}
        onSelect={() => onDelete(row)}
      >
        Delete…
      </MenuItem>
    </Menu>
  );
}

/** One line of a program's checklist. */
export function RequirementItem({
  row,
  applicationStatus,
  today,
  onChangeStatus,
  onEdit,
  onDelete,
}: RequirementItemProps) {
  const title = requirementTitle(row);
  const subtitle = requirementSubtitle(row);
  const due = requirementDue(row, applicationStatus, today);
  const done = isDone(row.status);

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
        <span className="mt-0.5">
          <RequirementStatusIcon status={row.status} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('break-words font-medium', done && 'text-fg-muted')}>{title}</span>
            {row.is_required ? null : <Badge>Optional</Badge>}
          </div>
          {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
          {row.due_date ? (
            <p className="mt-0.5 text-xs text-fg-muted">
              Due <span className="tabular-nums">{formatDate(row.due_date)}</span>
              {due.text ? (
                <span className={cn('ml-2 font-medium', toneText[due.tone])}>{due.text}</span>
              ) : null}
            </p>
          ) : null}
          {row.notes ? (
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">
              {row.notes}
            </p>
          ) : null}
        </div>
      </div>
      <div className="ml-8 flex shrink-0 items-center gap-1 sm:ml-0">
        <RequirementStatusMenu
          status={row.status}
          name={title}
          onChange={(status) => onChangeStatus(row, status)}
        />
        <ItemActions row={row} title={title} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </li>
  );
}
