import {
  ChevronDown,
  Circle,
  CircleCheck,
  CircleDashed,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Menu, MenuItem } from '@/components/ui';
import { toneText } from '@/components/ui/tone';
import { cn } from '@/lib/cn';
import { getRequirementStatusMeta, REQUIREMENT_STATUSES, type RequirementStatus } from './kinds';

const icons: Record<RequirementStatus, LucideIcon> = {
  not_started: Circle,
  in_progress: CircleDashed,
  complete: CircleCheck,
  submitted: Send,
};

/** A small mark beside an item. Decorative: the status is always also written out. */
export function RequirementStatusIcon({ status }: { status: RequirementStatus }) {
  const Icon = icons[status];
  const { tone } = getRequirementStatusMeta(status);
  return <Icon aria-hidden="true" className={cn('size-5 shrink-0', toneText[tone])} />;
}

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  const { label, tone } = getRequirementStatusMeta(status);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

type RequirementStatusMenuProps = {
  status: RequirementStatus;
  /** What the status belongs to, for screen readers: "Transcript". */
  name: string;
  onChange: (status: RequirementStatus) => void;
};

/** The status badge as a button: click it to move the item to another status. */
export function RequirementStatusMenu({ status, name, onChange }: RequirementStatusMenuProps) {
  return (
    <Menu
      label={`Change status of ${name}`}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`${getRequirementStatusMeta(status).label}. Change status of ${name}`}
          className="focus-ring -mx-1 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 hover:bg-surface-muted"
        >
          <RequirementStatusBadge status={status} />
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
        </button>
      )}
    >
      {REQUIREMENT_STATUSES.map((item) => (
        <MenuItem
          key={item.value}
          checked={item.value === status}
          onSelect={() => {
            if (item.value !== status) onChange(item.value);
          }}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
