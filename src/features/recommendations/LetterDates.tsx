import { toneText } from '@/components/ui/tone';
import { formatDate } from '@/features/applications/dates';
import type { ApplicationStatus } from '@/features/applications/status';
import { cn } from '@/lib/cn';
import { requestDue } from './logic';
import type { RequestRow } from './types';

type LetterDatesProps = {
  request: Pick<RequestRow, 'status' | 'requested_on' | 'deadline'>;
  /** The program's own status: once it is sent or decided, an open letter is no longer "overdue". */
  applicationStatus: ApplicationStatus;
  today: string;
};

/** "Asked Oct 3, 2026 · Due Dec 1, 2026  In 10 days": when the letter was asked for and is due. */
export function LetterDates({ request, applicationStatus, today }: LetterDatesProps) {
  const due = requestDue(request, applicationStatus, today);
  const asked = request.requested_on ? (
    <>
      Asked <span className="tabular-nums">{formatDate(request.requested_on)}</span>
    </>
  ) : request.status === 'not_requested' ? (
    'Not asked yet'
  ) : null;

  if (!asked && !request.deadline) return null;
  return (
    <p className="text-xs text-fg-muted">
      {asked}
      {asked && request.deadline ? ' · ' : null}
      {request.deadline ? (
        <>
          Due <span className="tabular-nums">{formatDate(request.deadline)}</span>
          {due.text ? (
            <span className={cn('ml-2 font-medium', toneText[due.tone])}>{due.text}</span>
          ) : null}
        </>
      ) : null}
    </p>
  );
}
