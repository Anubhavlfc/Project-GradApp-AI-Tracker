import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import type { ApplicationRecord } from '@/features/applications/types';
import { toDataError } from '@/lib/dataError';
import { useApplicationFunding } from './hooks';
import { describeProgramFunding, summarizeProgramFunding } from './logic';

/** A program's funding at a glance, on the Overview tab: the best news, and a way into the list. */
export function FundingOverviewCard({ record }: { record: ApplicationRecord }) {
  const query = useApplicationFunding(record.id);
  const items = query.data;
  const to = `/app/applications/${record.id}/funding`;

  function body() {
    if (items === undefined) {
      return query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Unable to load funding</p>
            <p className="text-fg-muted">{toDataError(query.error).message}</p>
          </div>
          <Button size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <SkeletonRegion label="Loading funding">
          <Skeleton className="h-10 w-full" />
        </SkeletonRegion>
      );
    }
    if (items.length === 0) return <p className="text-fg-muted">No funding tracked yet.</p>;

    const funding = summarizeProgramFunding(items);
    const headline = describeProgramFunding(funding);
    return (
      <div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={headline.tone}>{headline.label}</Badge>
          {headline.amount ? (
            <span className="font-medium tabular-nums">{headline.amount}</span>
          ) : null}
        </p>
        <p className="mt-1.5 text-xs text-fg-muted">
          {items.length} {items.length === 1 ? 'item' : 'items'} tracked
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Funding"
        action={
          items === undefined ? undefined : (
            <ButtonLink to={to} size="sm">
              {items.length === 0 ? 'Add funding' : 'View funding'}
            </ButtonLink>
          )
        }
      />
      <CardBody>{body()}</CardBody>
    </Card>
  );
}
