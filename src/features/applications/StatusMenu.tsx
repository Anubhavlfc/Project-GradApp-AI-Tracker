import { ChevronDown } from 'lucide-react';
import { Menu, MenuItem } from '@/components/ui';
import { APPLICATION_STATUSES, getStatusMeta, type ApplicationStatus } from './status';
import { StatusBadge } from './StatusBadge';

type StatusMenuProps = {
  status: ApplicationStatus;
  /** What the status belongs to, for screen readers: "Stanford University, Computer Science". */
  name: string;
  /** Let a long status wrap onto two lines when the space is tight (the phone cards). */
  wrap?: boolean;
  onChange: (status: ApplicationStatus) => void;
};

/** The status badge as a button: click it to move the application to another status. */
export function StatusMenu({ status, name, wrap, onChange }: StatusMenuProps) {
  return (
    <Menu
      label={`Change status of ${name}`}
      align="start"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`${getStatusMeta(status).label}. Change status of ${name}`}
          className="focus-ring -mx-1 inline-flex max-w-full items-center gap-0.5 rounded-md px-1 py-0.5 text-left hover:bg-surface-muted"
        >
          <StatusBadge status={status} wrap={wrap} />
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
        </button>
      )}
    >
      {APPLICATION_STATUSES.map((item) => (
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
