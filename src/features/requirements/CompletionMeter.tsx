import { CircleCheck } from 'lucide-react';
import { ProgressBar, Skeleton } from '@/components/ui';
import type { Completion, ProgressLookup } from './progress';

/** An empty value: a dash for the eye, the reason for a screen reader. */
function NoValue({ reason }: { reason: string }) {
  return (
    <span className="text-fg-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

type CompletionCellProps = {
  status: ProgressLookup['status'];
  completion: Completion | undefined;
  /** Whose progress this is, for screen readers: "Stanford University, Computer Science". */
  name: string;
};

/** One program's progress in the applications list: a bar with "8 of 11 · 73%" under it. */
export function CompletionCell({ status, completion, name }: CompletionCellProps) {
  if (status === 'loading') return <Skeleton className="h-4 w-24" />;
  if (status === 'unavailable') return <NoValue reason="Progress isn't available right now" />;
  if (!completion || completion.percent === null) {
    return <NoValue reason="No requirements to complete yet" />;
  }
  return (
    <div className="w-28">
      <ProgressBar value={completion.percent} label={`Requirements completed for ${name}`} />
      <p className="mt-1 text-xs tabular-nums text-fg-muted">
        {completion.done} of {completion.total} · {completion.percent}%
      </p>
    </div>
  );
}

/** The headline for a program's checklist: how many required items are done, and what is left. */
export function CompletionSummary({ completion, name }: { completion: Completion; name: string }) {
  const { done, total, percent } = completion;
  const details = [
    completion.inProgress > 0 ? `${completion.inProgress} in progress` : null,
    completion.notStarted > 0 ? `${completion.notStarted} not started` : null,
    completion.optional > 0 ? `${completion.optional} optional` : null,
  ].filter(Boolean);

  if (percent === null) {
    return (
      <p className="text-fg-muted">
        No required items yet.
        {completion.optional > 0
          ? ' Everything on this list is optional, so there is no progress to show.'
          : ''}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p>
          <span className="text-2xl font-semibold tabular-nums tracking-tight">
            {done} of {total}
          </span>{' '}
          <span className="text-fg-muted">required items done</span>
        </p>
        <p className="text-lg font-semibold tabular-nums">{percent}%</p>
      </div>
      <ProgressBar className="mt-2" value={percent} label={`Requirements completed for ${name}`} />
      {done === total ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-tone-green-fg">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          Every required item is done.
        </p>
      ) : details.length > 0 ? (
        <p className="mt-2 text-xs text-fg-muted">{details.join(' · ')}</p>
      ) : null}
    </div>
  );
}
