import { CircleCheck } from 'lucide-react';
import { Badge, ButtonLink } from '@/components/ui';
import { useToday } from '@/features/applications/useToday';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { useRecommendersQuery, useRequestsQuery } from '@/features/recommendations/hooks';
import { getRecommendationStatusMeta } from '@/features/recommendations/statuses';
import { CompactRow } from './CompactRow';
import { DashboardCard } from './DashboardCard';
import { DueLabel } from './DueLabel';
import { gather } from './gather';
import { letterProgress, lettersNeedingAttention } from './logic';

/** How many letters the dashboard lists; the program's Recommendations tab has the rest. */
export const LETTERS_SHOWN = 5;

/** Recommendation letters that are late, due soon, or waiting on a nudge. */
export function LettersCard() {
  const applications = useApplicationsQuery();
  const recommenders = useRecommendersQuery();
  const requests = useRequestsQuery();
  const today = useToday();
  return (
    <DashboardCard
      title="Recommendation letters"
      description="Letters that need a nudge, for the programs you are still preparing."
      action={
        <ButtonLink to="/app/recommenders" size="sm">
          View all
        </ButtonLink>
      }
      state={gather([applications, recommenders, requests])}
      failedTitle="Unable to load your letters"
    >
      {() => {
        if (!applications.data || !recommenders.data || !requests.data) return null;
        const progress = letterProgress(applications.data, requests.data);
        if (progress.total === 0) {
          return (
            <p className="p-4 text-fg-muted">
              No letters to track yet. Add a recommender, then request a letter for a program.
            </p>
          );
        }

        const warnings = lettersNeedingAttention({
          records: applications.data,
          recommenders: recommenders.data,
          requests: requests.data,
          today,
        });
        return (
          <>
            <div className="border-b border-border p-4">
              <p className="text-fg-muted">
                <span className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
                  {progress.submitted} of {progress.total}
                </span>{' '}
                {progress.total === 1 ? 'letter' : 'letters'} submitted
              </p>
            </div>
            {warnings.length === 0 ? (
              <p className="flex items-center gap-1.5 p-4 font-medium text-tone-green-fg">
                <CircleCheck aria-hidden="true" className="size-4" />
                No letters need attention.
              </p>
            ) : (
              <ul aria-label="Letters that need attention" className="divide-y divide-border">
                {warnings.slice(0, LETTERS_SHOWN).map(({ request, recommender, record, info }) => {
                  const status = getRecommendationStatusMeta(request.status);
                  return (
                    <CompactRow
                      key={request.id}
                      title={
                        recommender ? `Letter from ${recommender.name}` : 'Recommendation letter'
                      }
                      href={`/app/applications/${record.id}/recommendations`}
                      context={applicationName(record)}
                      trailing={
                        <>
                          <DueLabel date={request.deadline} info={info} />
                          <Badge tone={status.tone} className="mt-1">
                            {status.label}
                          </Badge>
                        </>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </>
        );
      }}
    </DashboardCard>
  );
}
