import { Badge, Skeleton } from '@/components/ui';
import { describeProgramFunding, type FundingLookup, type ProgramFunding } from './logic';

/** An empty value: a dash for the eye, the reason for a screen reader. */
function NoValue({ reason }: { reason: string }) {
  return (
    <span className="text-fg-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

type FundingCellProps = {
  status: FundingLookup['status'];
  funding: ProgramFunding | undefined;
};

/** One program's funding in the applications list: the best news, with the money behind it. */
export function FundingCell({ status, funding }: FundingCellProps) {
  if (status === 'loading') return <Skeleton className="h-4 w-20" />;
  if (status === 'unavailable') return <NoValue reason="Funding isn't available right now" />;
  if (!funding) return <NoValue reason="No funding tracked" />;
  const headline = describeProgramFunding(funding);
  return (
    <div>
      <Badge tone={headline.tone}>{headline.label}</Badge>
      {headline.amount ? (
        <p className="mt-1 text-xs tabular-nums text-fg-muted">{headline.amount}</p>
      ) : null}
    </div>
  );
}
