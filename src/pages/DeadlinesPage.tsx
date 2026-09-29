import { CalendarClock } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { DeadlineRow } from '@/features/deadlines/DeadlineRow';
import { useDeadlines } from '@/features/deadlines/hooks';
import { countDeadlines, describeDeadlineCounts, groupDeadlines } from '@/features/deadlines/logic';
import { describeProblem } from '@/features/deadlines/problem';
import { toDataError } from '@/lib/dataError';

function ListSkeleton() {
  return (
    <SkeletonRegion label="Loading deadlines">
      <div className="space-y-6">
        <Skeleton className="h-5 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Every date you have written down, across your programs, soonest first. */
export function DeadlinesPage() {
  const deadlines = useDeadlines();

  function renderBody() {
    if (deadlines.status === 'loading') return <ListSkeleton />;

    if (deadlines.status === 'failed') {
      return (
        <Alert
          kind="danger"
          title="Unable to load deadlines"
          action={
            <Button size="sm" onClick={deadlines.retry}>
              Try again
            </Button>
          }
        >
          {toDataError(deadlines.error).message}
        </Alert>
      );
    }

    const { items, problem } = deadlines;
    const groups = groupDeadlines(items);
    const warning = problem ? describeProblem(problem) : null;

    return (
      <div className="space-y-6">
        {warning ? (
          <Alert
            kind="warning"
            title={warning.title}
            action={
              <Button size="sm" onClick={deadlines.retry}>
                Try again
              </Button>
            }
          >
            {warning.message}
          </Alert>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No upcoming deadlines."
            description="Give a program, a checklist item, a letter, a scholarship or a task a date, and it will be listed here, soonest first."
            action={
              <ButtonLink to="/app/applications" variant="primary">
                Go to applications
              </ButtonLink>
            }
          />
        ) : (
          <>
            <p className="text-fg-muted">{describeDeadlineCounts(countDeadlines(items))}</p>
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`deadlines-${group.key}`}>
                <h2
                  id={`deadlines-${group.key}`}
                  className="mb-2 text-sm font-semibold text-fg-muted"
                >
                  {group.title}
                  <span aria-hidden="true" className="ml-2 font-normal tabular-nums">
                    {group.items.length}
                  </span>
                </h2>
                <Card>
                  <ul aria-labelledby={`deadlines-${group.key}`} className="divide-y divide-border">
                    {group.items.map((item) => (
                      <DeadlineRow key={item.id} item={item} />
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Deadlines"
        description="Every date you have written down, across your programs, soonest first."
      />
      {renderBody()}
    </>
  );
}
