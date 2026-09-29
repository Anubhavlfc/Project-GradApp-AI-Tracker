import type { ComponentPropsWithRef } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';

type TableContainerProps = ComponentPropsWithRef<'div'> & {
  /** Names the scrollable region for screen readers. */
  label: string;
};

/** Scrolls horizontally on small screens; focusable so keyboard users can scroll it. */
export function TableContainer({ label, className, ...props }: TableContainerProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        'focus-ring relative overflow-x-auto rounded-lg border border-border bg-surface',
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentPropsWithRef<'table'>) {
  return <table className={cn('w-full text-left text-sm', className)} {...props} />;
}

export function TableHead(props: ComponentPropsWithRef<'thead'>) {
  return <thead {...props} />;
}

export function TableBody({ className, ...props }: ComponentPropsWithRef<'tbody'>) {
  return <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentPropsWithRef<'tr'>) {
  return <tr className={cn('hover:bg-surface-muted/60', className)} {...props} />;
}

export type SortDirection = 'asc' | 'desc';

type TableHeaderCellProps = ComponentPropsWithRef<'th'> & {
  /** Set on sortable columns: the current direction, or null when not sorted by this column. */
  sortDirection?: SortDirection | null;
  onSort?: () => void;
};

const ariaSort = { asc: 'ascending', desc: 'descending' } as const;

const headerCell =
  'h-10 whitespace-nowrap border-b border-border bg-surface-muted px-3 text-left text-xs font-medium text-fg-muted';

export function TableHeaderCell({
  sortDirection,
  onSort,
  className,
  children,
  ...props
}: TableHeaderCellProps) {
  if (!onSort) {
    return (
      <th scope="col" className={cn(headerCell, className)} {...props}>
        {children}
      </th>
    );
  }
  const Icon =
    sortDirection === 'asc' ? ArrowUp : sortDirection === 'desc' ? ArrowDown : ChevronsUpDown;
  return (
    <th
      scope="col"
      aria-sort={sortDirection ? ariaSort[sortDirection] : 'none'}
      className={cn(headerCell, className)}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className="focus-ring -mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:text-fg"
      >
        {children}
        <Icon aria-hidden="true" className={cn('size-3.5', !sortDirection && 'opacity-50')} />
      </button>
    </th>
  );
}

export function TableCell({ className, ...props }: ComponentPropsWithRef<'td'>) {
  return (
    <td className={cn('border-b border-border px-3 py-2.5 align-middle', className)} {...props} />
  );
}
