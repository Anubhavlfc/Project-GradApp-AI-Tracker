import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { Button, Card, ItemMenu } from '@/components/ui';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { LetterDates } from './LetterDates';
import type { LetterActions } from './LetterRow';
import { LetterStatusPicker } from './LetterStatus';
import { describeLetters, recommenderSubtitle, summarizeRequests } from './logic';
import type { RecommenderRow, RequestRow } from './types';

type RecommenderCardProps = LetterActions & {
  recommender: RecommenderRow;
  /** This person's letters, in the order to show them. */
  requests: readonly RequestRow[];
  /** Every program, to name each letter's program. */
  applications: ReadonlyMap<string, ApplicationRecord>;
  today: string;
  onEditRecommender: (recommender: RecommenderRow) => void;
  onDeleteRecommender: (recommender: RecommenderRow) => void;
  onRequestLetter: (recommender: RecommenderRow) => void;
};

/** One person on the Recommenders page, with every letter they have been asked for. */
export function RecommenderCard({
  recommender,
  requests,
  applications,
  today,
  onEditRecommender,
  onDeleteRecommender,
  onRequestLetter,
  onChangeStatus,
  onEdit,
  onDelete,
}: RecommenderCardProps) {
  const subtitle = recommenderSubtitle(recommender);
  return (
    <Card>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="break-words text-base font-semibold leading-6">{recommender.name}</h2>
          {subtitle ? <p className="break-words text-fg-muted">{subtitle}</p> : null}
          {recommender.email ? (
            <p className="break-all text-xs">
              <a
                href={`mailto:${recommender.email}`}
                className="focus-ring rounded-sm text-accent hover:underline"
              >
                {recommender.email}
              </a>
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-fg-muted">
            {describeLetters(summarizeRequests(requests))}
          </p>
          {recommender.notes ? (
            <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">
              {recommender.notes}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" onClick={() => onRequestLetter(recommender)}>
            <Plus aria-hidden="true" className="size-4" />
            Request a letter <span className="sr-only">from {recommender.name}</span>
          </Button>
          <ItemMenu
            subject={recommender.name}
            editLabel="Edit recommender"
            deleteLabel="Delete recommender…"
            onEdit={() => onEditRecommender(recommender)}
            onDelete={() => onDeleteRecommender(recommender)}
          />
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="border-t border-border px-4 py-3 text-fg-muted">No letters requested yet.</p>
      ) : (
        <ul aria-label={`Letters from ${recommender.name}`} className="border-t border-border">
          {requests.map((request) => {
            const application = applications.get(request.application_id);
            const program = application ? applicationName(application) : 'Unknown program';
            const subject = `${recommender.name}'s letter for ${program}`;
            return (
              <li
                key={request.id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1 basis-56">
                  <p className="break-words font-medium leading-6">
                    {application ? (
                      <Link
                        to={`/app/applications/${application.id}/recommendations`}
                        className="focus-ring rounded-sm hover:underline"
                      >
                        {program}
                      </Link>
                    ) : (
                      program
                    )}
                  </p>
                  <LetterDates
                    request={request}
                    applicationStatus={application?.status ?? 'researching'}
                    today={today}
                  />
                  {request.notes ? (
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">
                      {request.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:-my-1.5">
                  <LetterStatusPicker
                    status={request.status}
                    name={subject}
                    onChange={(status) => onChangeStatus(request, status)}
                  />
                  <ItemMenu
                    subject={subject}
                    editLabel="Edit request"
                    deleteLabel="Remove request…"
                    onEdit={() => onEdit(request)}
                    onDelete={() => onDelete(request)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
