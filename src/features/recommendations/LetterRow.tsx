import { ItemMenu } from '@/components/ui';
import type { ApplicationStatus } from '@/features/applications/status';
import { LetterDates } from './LetterDates';
import { LetterStatusPicker } from './LetterStatus';
import { recommenderSubtitle } from './logic';
import type { RecommendationStatus } from './statuses';
import type { Letter } from './hooks';
import type { RequestRow } from './types';

export type LetterActions = {
  onChangeStatus: (request: RequestRow, status: RecommendationStatus) => void;
  onEdit: (request: RequestRow) => void;
  onDelete: (request: RequestRow) => void;
};

type LetterRowProps = LetterActions & {
  letter: Letter;
  applicationStatus: ApplicationStatus;
  today: string;
};

/** One letter on a program's page: who is writing it, when it is due, and where it stands. */
export function LetterRow({
  letter,
  applicationStatus,
  today,
  onChangeStatus,
  onEdit,
  onDelete,
}: LetterRowProps) {
  const { request, recommender } = letter;
  const subtitle = recommenderSubtitle(recommender);
  const subject = `${recommender.name}'s letter`;
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="break-words font-medium leading-6">{recommender.name}</p>
        {subtitle ? <p className="break-words text-xs text-fg-muted">{subtitle}</p> : null}
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
        <div className="mt-0.5">
          <LetterDates request={request} applicationStatus={applicationStatus} today={today} />
        </div>
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
}
