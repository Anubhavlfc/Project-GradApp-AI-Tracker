import { ButtonLink } from '@/components/ui';
import { DeadlineRow } from '@/features/deadlines/DeadlineRow';
import { useDeadlines, type Deadlines } from '@/features/deadlines/hooks';
import { describeProblem } from '@/features/deadlines/problem';
import { DashboardCard } from './DashboardCard';
import type { CardState } from './gather';

/** How many dates the dashboard lists; the Deadlines page has the rest. */
export const DEADLINES_SHOWN = 6;

function stateOf(deadlines: Deadlines): CardState {
  if (deadlines.status !== 'ready') return deadlines;
  const { problem, retry } = deadlines;
  return {
    status: 'ready',
    warning: problem ? { ...describeProblem(problem), retry } : null,
  };
}

/** The next dates across every program: application deadlines, checklist items, letters, tasks. */
export function UpcomingDeadlinesCard() {
  const deadlines = useDeadlines();
  return (
    <DashboardCard
      title="Upcoming deadlines"
      description="What is due next, across your programs."
      action={
        <ButtonLink to="/app/deadlines" size="sm">
          View all
        </ButtonLink>
      }
      state={stateOf(deadlines)}
      failedTitle="Unable to load deadlines"
    >
      {() => {
        if (deadlines.status !== 'ready') return null;
        const { items } = deadlines;
        if (items.length === 0) {
          return (
            <p className="p-4 text-fg-muted">
              Nothing is due. Give a program, a checklist item, a letter or a task a date and it
              will be listed here.
            </p>
          );
        }
        return (
          <ul aria-label="Upcoming deadlines" className="divide-y divide-border">
            {items.slice(0, DEADLINES_SHOWN).map((item) => (
              <DeadlineRow key={item.id} item={item} />
            ))}
          </ul>
        );
      }}
    </DashboardCard>
  );
}
