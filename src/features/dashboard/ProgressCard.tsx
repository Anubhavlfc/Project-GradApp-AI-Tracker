import { CircleCheck } from 'lucide-react';
import { ButtonLink, ProgressBar } from '@/components/ui';
import { formatDate } from '@/features/applications/dates';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { getStatusMeta } from '@/features/applications/status';
import { useRequirementsQuery } from '@/features/requirements/hooks';
import { CompletionCell } from '@/features/requirements/CompletionMeter';
import { completionsByApplication } from '@/features/requirements/progress';
import { CompactRow } from './CompactRow';
import { DashboardCard } from './DashboardCard';
import { gather } from './gather';
import { overallProgress, programsToPrepare } from './logic';

/** How many programs the dashboard lists; the Applications page has the rest. */
export const PROGRAMS_SHOWN = 6;

/** How far along the required checklist items are, overall and for each program still to prepare. */
export function ProgressCard() {
  const applications = useApplicationsQuery();
  const requirements = useRequirementsQuery();
  return (
    <DashboardCard
      title="Application progress"
      description="Required checklist items done, for the programs you are still preparing."
      action={
        <ButtonLink to="/app/applications" size="sm">
          View all
        </ButtonLink>
      }
      state={gather([applications, requirements])}
      failedTitle="Unable to load your progress"
    >
      {() => {
        if (!applications.data || !requirements.data) return null;
        const preparing = programsToPrepare(applications.data);
        if (preparing.length === 0) {
          return (
            <p className="p-4 text-fg-muted">
              Nothing left to prepare: every program is sent, decided or withdrawn.
            </p>
          );
        }

        const completions = completionsByApplication(requirements.data);
        const overall = overallProgress(applications.data, completions);
        return (
          <>
            <div className="border-b border-border p-4">
              {overall.percent === null ? (
                <p className="text-fg-muted">
                  Add required items to a program’s checklist to see your progress here.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p>
                      <span className="text-2xl font-semibold tabular-nums tracking-tight">
                        {overall.done} of {overall.total}
                      </span>{' '}
                      <span className="text-fg-muted">required items done</span>
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{overall.percent}%</p>
                  </div>
                  <ProgressBar
                    className="mt-2"
                    value={overall.percent}
                    label="Overall checklist completion"
                  />
                  {overall.done === overall.total ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-tone-green-fg">
                      <CircleCheck aria-hidden="true" className="size-3.5" />
                      Every required item is done.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-fg-muted">
                      {overall.total - overall.done} left across {overall.programs}{' '}
                      {overall.programs === 1 ? 'program' : 'programs'}.
                    </p>
                  )}
                </>
              )}
            </div>
            <ul aria-label="Programs still to prepare" className="divide-y divide-border">
              {preparing.slice(0, PROGRAMS_SHOWN).map((record) => {
                const name = applicationName(record);
                const context = [
                  getStatusMeta(record.status).label,
                  record.deadline ? `Deadline ${formatDate(record.deadline)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <CompactRow
                    key={record.id}
                    title={name}
                    href={`/app/applications/${record.id}/requirements`}
                    context={context}
                    trailing={
                      <CompletionCell
                        status="ready"
                        completion={completions.get(record.id)}
                        name={name}
                      />
                    }
                  />
                );
              })}
            </ul>
          </>
        );
      }}
    </DashboardCard>
  );
}
