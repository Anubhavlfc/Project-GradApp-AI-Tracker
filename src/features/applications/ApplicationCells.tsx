import { Badge, type Tone } from '@/components/ui';
import { toneText } from '@/components/ui/tone';
import { cn } from '@/lib/cn';
import { formatDate, getDeadlineInfo } from './dates';
import { priorityLabel, type Priority } from './labels';
import { formatMoney } from './money';
import type { ApplicationRecord } from './types';

// Small pieces shared by the table rows and the phone cards.

/** An empty value: a dash for the eye, "Not set" for a screen reader. */
export function NotSet() {
  return (
    <span className="text-fg-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not set</span>
    </span>
  );
}

export function DeadlineText({ record, today }: { record: ApplicationRecord; today: string }) {
  if (!record.deadline) return <NotSet />;
  const info = getDeadlineInfo(record, today);
  return (
    <div>
      <div className="tabular-nums">{formatDate(record.deadline)}</div>
      {info.text ? (
        <div className={cn('text-xs font-medium', toneText[info.tone])}>{info.text}</div>
      ) : null}
    </div>
  );
}

export function FeeText({ record }: { record: ApplicationRecord }) {
  if (record.application_fee === null) return <NotSet />;
  const waived = record.fee_waiver_status === 'granted';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={cn('tabular-nums', waived && 'text-fg-muted line-through')}>
        {formatMoney(record.application_fee, record.fee_currency)}
      </span>
      {waived ? (
        <Badge tone="green">Waived</Badge>
      ) : record.fee_paid_on ? (
        <Badge tone="green">Paid</Badge>
      ) : null}
    </span>
  );
}

const priorityTone: Record<Priority, Tone> = { dream: 'violet', target: 'blue', safety: 'teal' };

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  return priority ? (
    <Badge tone={priorityTone[priority]}>{priorityLabel(priority)}</Badge>
  ) : (
    <NotSet />
  );
}
