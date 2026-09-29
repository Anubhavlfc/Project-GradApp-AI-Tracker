import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { toDataError } from '@/features/applications/errors';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { CompletionSummary } from './CompletionMeter';
import { useApplicationRequirements } from './hooks';
import { summarize } from './progress';

/** A program's checklist at a glance, on the Overview tab: the total, and a way into the list. */
export function RequirementsOverviewCard({ record }: { record: ApplicationRecord }) {
  const query = useApplicationRequirements(record.id);
  const items = query.data;
  const to = `/app/applications/${record.id}/requirements`;

  function body() {
    if (items === undefined) {
      return query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Unable to load requirements</p>
            <p className="text-fg-muted">{toDataError(query.error).message}</p>
          </div>
          <Button size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <SkeletonRegion label="Loading requirements">
          <Skeleton className="h-16 w-full" />
        </SkeletonRegion>
      );
    }
    if (items.length === 0) return <p className="text-fg-muted">No requirements yet.</p>;
    return <CompletionSummary completion={summarize(items)} name={applicationName(record)} />;
  }

  return (
    <Card>
      <CardHeader
        title="Requirements"
        action={
          items === undefined ? undefined : (
            <ButtonLink to={to} size="sm">
              {items.length === 0 ? 'Add requirements' : 'View checklist'}
            </ButtonLink>
          )
        }
      />
      <CardBody>{body()}</CardBody>
    </Card>
  );
}
