import type { ReactNode } from 'react';

/** Label/value pairs, e.g. the facts on a details page. Labels sit beside values from `sm` up. */
export function DescriptionList({ children }: { children: ReactNode }) {
  return <dl className="space-y-3">{children}</dl>;
}

export function DescriptionItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-x-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
