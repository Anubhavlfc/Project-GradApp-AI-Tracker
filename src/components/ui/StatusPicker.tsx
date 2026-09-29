import { ChevronDown } from 'lucide-react';
import { Badge } from './Badge';
import { Menu, MenuItem } from './Menu';
import type { Tone } from './tone';

export type StatusOption<T extends string> = { value: T; label: string; tone: Tone };

type StatusPickerProps<T extends string> = {
  value: T;
  options: readonly StatusOption<T>[];
  /** What the status belongs to, for screen readers: "Transcript". */
  subject: string;
  onChange: (value: T) => void;
};

/** A status badge that is also a button: click it to move to another status. */
export function StatusPicker<T extends string>({
  value,
  options,
  subject,
  onChange,
}: StatusPickerProps<T>) {
  const current = options.find((option) => option.value === value);
  return (
    <Menu
      label={`Change status of ${subject}`}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`${current?.label ?? value}. Change status of ${subject}`}
          className="focus-ring -mx-1 inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 hover:bg-surface-muted"
        >
          <Badge tone={current?.tone} dot>
            {current?.label ?? value}
          </Badge>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
        </button>
      )}
    >
      {options.map((option) => (
        <MenuItem
          key={option.value}
          checked={option.value === value}
          onSelect={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
