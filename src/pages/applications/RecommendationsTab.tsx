import { useState } from 'react';
import { Mail, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { toISODate } from '@/features/applications/dates';
import { applicationName } from '@/features/applications/labels';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { DeleteRequestDialog } from '@/features/recommendations/DeleteRequestDialog';
import { useApplicationLetters, useRequestActions } from '@/features/recommendations/hooks';
import { LetterProgress } from '@/features/recommendations/LetterProgress';
import { LetterRow } from '@/features/recommendations/LetterRow';
import { summarizeRequests } from '@/features/recommendations/logic';
import { RequestDialog, type RequestTarget } from '@/features/recommendations/RequestDialog';
import type { RequestRow } from '@/features/recommendations/types';
import { toDataError } from '@/lib/dataError';

function LettersSkeleton() {
  return (
    <SkeletonRegion label="Loading recommendation letters">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** A program's recommendation letters: who is writing each, when it is due, and where it stands. */
export function RecommendationsTab() {
  const record = useApplicationRecord();
  const { letters, failed, stale, error, retry } = useApplicationLetters(record.id);
  const actions = useRequestActions();
  const today = toISODate();
  const name = applicationName(record);

  const [requesting, setRequesting] = useState<RequestTarget | null>(null);
  const [toRemove, setToRemove] = useState<RequestRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const removing = letters?.find((letter) => letter.request.id === toRemove?.id);
  const request = () => setRequesting({ kind: 'new', applicationId: record.id });

  function renderBody() {
    if (letters === undefined) {
      return failed ? (
        <Alert
          kind="danger"
          title="Unable to load recommendation letters"
          action={
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          }
        >
          {toDataError(error).message}
        </Alert>
      ) : (
        <LettersSkeleton />
      );
    }

    if (letters.length === 0) {
      return (
        <EmptyState
          icon={Mail}
          title="No letters requested yet."
          description="Record who is writing a letter for this program, when it is due, and whether it has been sent."
          action={
            <Button variant="primary" onClick={request}>
              Request a letter
            </Button>
          }
        />
      );
    }

    const summary = summarizeRequests(letters.map((letter) => letter.request));
    return (
      <div className="space-y-4">
        {stale ? (
          <Alert
            kind="warning"
            title="Unable to refresh recommendation letters"
            action={
              <Button size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded. {toDataError(error).message}
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="Progress" />
          <CardBody>
            <LetterProgress summary={summary} name={name} />
            {/* Says the new total out loud after a change, since the row itself only changes colour. */}
            <p aria-live="polite" className="sr-only">
              {`${summary.submitted} of ${summary.total} letters submitted.`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Recommendation letters</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                Who is writing a letter for this program, and where each one stands.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={request}>
              <Plus aria-hidden="true" className="size-4" />
              Request a letter
            </Button>
          </div>
          <ul aria-label="Recommendation letters" className="divide-y divide-border">
            {letters.map((letter) => (
              <LetterRow
                key={letter.request.id}
                letter={letter}
                applicationStatus={record.status}
                today={today}
                onChangeStatus={actions.setStatus}
                onEdit={(row) => setRequesting({ kind: 'edit', request: row })}
                onDelete={setToRemove}
              />
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {notice ? (
          <Alert
            kind="success"
            title={notice}
            action={
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                Dismiss
              </Button>
            }
          />
        ) : null}

        {actions.error ? (
          <Alert
            kind="danger"
            title="Couldn't update that letter"
            action={
              <Button size="sm" variant="ghost" onClick={actions.clearError}>
                Dismiss
              </Button>
            }
          >
            {actions.error}
          </Alert>
        ) : null}

        {renderBody()}
      </div>

      <RequestDialog target={requesting} onClose={() => setRequesting(null)} onSaved={setNotice} />
      <DeleteRequestDialog
        request={toRemove}
        who={removing?.recommender.name ?? 'this recommender'}
        program={name}
        onClose={() => setToRemove(null)}
        onDeleted={() => {
          const who = removing?.recommender.name ?? 'the recommender';
          setToRemove(null);
          setNotice(`Removed the request to ${who}.`);
        }}
      />
    </>
  );
}
