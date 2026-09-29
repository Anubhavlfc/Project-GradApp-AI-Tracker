import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { toDataError } from '@/lib/dataError';
import { useApplicationRequests } from './hooks';
import { LetterProgress } from './LetterProgress';
import { summarizeRequests } from './logic';

/** A program's letters at a glance, on the Overview tab: the count, and a way into the list. */
export function RecommendationsOverviewCard({ record }: { record: ApplicationRecord }) {
  const query = useApplicationRequests(record.id);
  const rows = query.data;
  const to = `/app/applications/${record.id}/recommendations`;

  function body() {
    if (rows === undefined) {
      return query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">Unable to load recommendation letters</p>
            <p className="text-fg-muted">{toDataError(query.error).message}</p>
          </div>
          <Button size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <SkeletonRegion label="Loading recommendation letters">
          <Skeleton className="h-16 w-full" />
        </SkeletonRegion>
      );
    }
    return <LetterProgress summary={summarizeRequests(rows)} name={applicationName(record)} />;
  }

  return (
    <Card>
      <CardHeader
        title="Recommendations"
        action={
          rows === undefined ? undefined : (
            <ButtonLink to={to} size="sm">
              {rows.length === 0 ? 'Request a letter' : 'View letters'}
            </ButtonLink>
          )
        }
      />
      <CardBody>{body()}</CardBody>
    </Card>
  );
}
