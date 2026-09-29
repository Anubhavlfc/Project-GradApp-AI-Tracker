import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('rounded-lg border border-border bg-surface', className)} {...props} />;
}

type CardHeaderProps = { title: string; description?: string; action?: ReactNode };

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

type StatProps = { label: string; value: ReactNode; hint?: string };

/** A single headline number, e.g. "In Progress: 3". */
export function Stat({ label, value, hint }: StatProps) {
  return (
    <Card className="p-4">
      <dl>
        <dt className="text-xs font-medium text-fg-muted">{label}</dt>
        <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</dd>
      </dl>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </Card>
  );
}
