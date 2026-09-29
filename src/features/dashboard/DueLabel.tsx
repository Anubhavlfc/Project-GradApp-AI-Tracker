import { toneText } from '@/components/ui/tone';
import { formatDate, type DeadlineInfo } from '@/features/applications/dates';
import { cn } from '@/lib/cn';

/** A date and how far away it is, on two lines: "Dec 15, 2026" over "In 5 days". */
export function DueLabel({ date, info }: { date: string | null; info: DeadlineInfo }) {
  return (
    <>
      {date ? <p className="tabular-nums">{formatDate(date)}</p> : null}
      {info.text ? (
        <p className={cn('text-xs font-medium', toneText[info.tone])}>{info.text}</p>
      ) : null}
    </>
  );
}
