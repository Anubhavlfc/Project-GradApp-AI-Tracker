import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Heading element for the title; use h1 when the empty state is the whole page. */
  as?: 'h1' | 'h2' | 'h3';
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  as: Heading = 'h2',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
      {Icon ? (
        <div className="mb-3 rounded-md bg-surface-muted p-2 text-fg-muted">
          <Icon aria-hidden="true" className="size-5" />
        </div>
      ) : null}
      <Heading className="text-base font-semibold">{title}</Heading>
      {description ? <p className="mt-1 max-w-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
