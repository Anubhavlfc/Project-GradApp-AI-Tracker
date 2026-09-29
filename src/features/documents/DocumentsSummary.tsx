import { CircleCheck } from 'lucide-react';
import { Card, CardBody, CardHeader, ProgressBar } from '@/components/ui';
import type { DocumentProgress } from './logic';

/** How many documents are done, as a bar and in words. Nothing until there is a document. */
export function DocumentsSummary({ progress }: { progress: DocumentProgress }) {
  const { total, complete, percent } = progress;
  if (percent === null) return null;
  const details = [
    progress.inProgress > 0 ? `${progress.inProgress} in progress` : null,
    progress.notStarted > 0 ? `${progress.notStarted} not started` : null,
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader title="Documents at a glance" />
      <CardBody>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {complete} of {total}
            </span>{' '}
            <span className="text-fg-muted">{total === 1 ? 'document' : 'documents'} complete</span>
          </p>
          <p className="text-lg font-semibold tabular-nums">{percent}%</p>
        </div>
        <ProgressBar className="mt-2" value={percent} label="Documents completed" />
        {complete === total ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-tone-green-fg">
            <CircleCheck aria-hidden="true" className="size-3.5" />
            Every document is complete.
          </p>
        ) : details.length > 0 ? (
          <p className="mt-2 text-xs text-fg-muted">{details.join(' · ')}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
