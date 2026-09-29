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
import { ActivityCard } from '@/features/activity/ActivityCard';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { summarizeStatuses } from '@/features/applications/summary';
import { UpcomingDeadlinesCard } from '@/features/dashboard/DeadlinesCard';
import { LettersCard } from '@/features/dashboard/LettersCard';
import { ProgressCard } from '@/features/dashboard/ProgressCard';
import { TasksCard } from '@/features/dashboard/TasksCard';

// Everything here is read from the person's own data: the counts from their programs, and each
// card from the same cached lists as the page it summarizes, so nothing on the dashboard can
// disagree with the pages behind it. A card that cannot load says so on its own and leaves the
// others alone. Nothing is shown before there is a program to show it about.
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

    const { total, withdrawn, groups } = summarizeStatuses(records);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            label="Total programs"
            value={total}
            hint={withdrawn > 0 ? `Includes ${withdrawn} withdrawn` : undefined}
          />
          {groups.map(({ label, count }) => (
            <Stat key={label} label={label} value={count} />
          ))}
        </div>

        {/* grid-cols-1: a column may shrink below its widest word, so a long unbroken link in a
            task or a note wraps on a phone instead of stretching the page. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <UpcomingDeadlinesCard />
          <ProgressCard />
          <TasksCard />
          <LettersCard />
        </div>

        <ActivityCard />
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
