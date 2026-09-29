import { FolderOpen, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonRegion,
  Stat,
} from '@/components/ui';
import { toDataError } from '@/lib/dataError';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { summarizeStatuses } from '@/features/applications/summary';

// A first, honest overview: counts of your own programs. Deadlines, tasks and progress arrive in
// the phases that add them (Phase 10 builds the full dashboard).
export function DashboardPage() {
  const query = useApplicationsQuery();
  const records = query.data;

  function renderBody() {
    if (records === undefined) {
      return query.isError ? (
        <Alert
          kind="danger"
          title="Unable to load programs"
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error).message}
        </Alert>
      ) : (
        <SkeletonRegion label="Loading your overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        </SkeletonRegion>
      );
    }

    if (records.length === 0) {
      return (
        <EmptyState
          icon={FolderOpen}
          title="No applications yet."
          description="Add your first graduate program to start tracking deadlines, documents, and requirements."
          action={
            <ButtonLink to="/app/applications/new" variant="primary">
              <Plus aria-hidden="true" className="size-4" />
              Add program
            </ButtonLink>
          }
        />
      );
    }

    const { total, groups } = summarizeStatuses(records);
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Programs" value={total} />
        {groups.map(({ label, count }) => (
          <Stat key={label} label={label} value={count} />
        ))}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where your applications stand."
        actions={
          records && records.length > 0 ? (
            <ButtonLink to="/app/applications">View applications</ButtonLink>
          ) : undefined
        }
      />
      {renderBody()}
    </>
  );
}
