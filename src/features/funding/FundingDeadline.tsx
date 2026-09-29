import { toneText } from '@/components/ui/tone';
import { formatDate } from '@/features/applications/dates';
import type { ApplicationStatus } from '@/features/applications/status';
import { cn } from '@/lib/cn';
import { fundingDue } from './logic';
import type { FundingRow } from './types';

type FundingDeadlineProps = {
  item: Pick<FundingRow, 'deadline' | 'status'>;
  /** The program's own status, or null when the item is tied to none. */
  applicationStatus: ApplicationStatus | null;
  today: string;
};

/** "Due Dec 1, 2026  In 10 days": when to apply by, while that still matters. */
export function FundingDeadline({ item, applicationStatus, today }: FundingDeadlineProps) {
  if (!item.deadline) return null;
  const due = fundingDue(item, applicationStatus, today);
  return (
    <p className="text-xs text-fg-muted">
      Due <span className="tabular-nums">{formatDate(item.deadline)}</span>
      {due.text ? (
        <span className={cn('ml-2 font-medium', toneText[due.tone])}>{due.text}</span>
      ) : null}
    </p>
  );
}
