import { useMemo, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Alert, Button, EmptyState, PageHeader, Skeleton, SkeletonRegion } from '@/components/ui';
import { useToday } from '@/features/applications/useToday';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import { DeleteRecommenderDialog } from '@/features/recommendations/DeleteRecommenderDialog';
import { DeleteRequestDialog } from '@/features/recommendations/DeleteRequestDialog';
import { useRecommendationData, useRequestActions } from '@/features/recommendations/hooks';
import { groupByRecommender } from '@/features/recommendations/logic';
import { RecommenderCard } from '@/features/recommendations/RecommenderCard';
import {
  RecommenderDialog,
  type RecommenderTarget,
} from '@/features/recommendations/RecommenderDialog';
import { RequestDialog, type RequestTarget } from '@/features/recommendations/RequestDialog';
import type { RecommenderRow, RequestRow } from '@/features/recommendations/types';
import { toDataError } from '@/lib/dataError';

const NO_REQUESTS: RequestRow[] = [];

function ListSkeleton() {
  return (
    <SkeletonRegion label="Loading recommenders">
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Everyone who writes (or will write) a letter for you, and every letter they have been asked for. */
export function RecommendersPage() {
  const data = useRecommendationData();
  const applicationsQuery = useApplicationsQuery();
  const actions = useRequestActions();
  const today = useToday();

  const [editingPerson, setEditingPerson] = useState<RecommenderTarget | null>(null);
  const [requesting, setRequesting] = useState<RequestTarget | null>(null);
  const [personToDelete, setPersonToDelete] = useState<RecommenderRow | null>(null);
  const [requestToRemove, setRequestToRemove] = useState<RequestRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { recommenders, requests } = data;
  const applications = applicationsQuery.data;

  const applicationsById = useMemo(
    () => new Map<string, ApplicationRecord>((applications ?? []).map((item) => [item.id, item])),
    [applications],
  );
  const lettersByPerson = useMemo(
    () =>
      groupByRecommender(requests ?? NO_REQUESTS, (request) => {
        const application = applicationsById.get(request.application_id);
        return application ? applicationName(application) : '';
      }),
    [requests, applicationsById],
  );

  const failed = data.failed || (applications === undefined && applicationsQuery.isError);
  const loading =
    recommenders === undefined || requests === undefined || applications === undefined;

  function retry() {
    data.retry();
    void applicationsQuery.refetch();
  }

  function renderBody() {
    if (loading) {
      return failed ? (
        <Alert
          kind="danger"
          title="Unable to load recommenders"
          action={
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          }
        >
          {toDataError(data.error ?? applicationsQuery.error).message}
        </Alert>
      ) : (
        <ListSkeleton />
      );
    }

    if (recommenders.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title="No recommenders yet."
          description="Add the people who will write your letters, then track who you have asked, when each letter is due, and whether it has been sent."
          action={
            <Button variant="primary" onClick={() => setEditingPerson('new')}>
              Add recommender
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {data.stale || applicationsQuery.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh recommenders"
            action={
              <Button size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded.{' '}
            {toDataError(data.error ?? applicationsQuery.error).message}
          </Alert>
        ) : null}
        {recommenders.map((person) => (
          <RecommenderCard
            key={person.id}
            recommender={person}
            requests={lettersByPerson.get(person.id) ?? NO_REQUESTS}
            applications={applicationsById}
            today={today}
            onEditRecommender={setEditingPerson}
            onDeleteRecommender={setPersonToDelete}
            onRequestLetter={(recommender) =>
              setRequesting({ kind: 'new', recommenderId: recommender.id })
            }
            onChangeStatus={actions.setStatus}
            onEdit={(request) => setRequesting({ kind: 'edit', request })}
            onDelete={setRequestToRemove}
          />
        ))}
      </div>
    );
  }

  const personOf = (request: RequestRow | null) =>
    recommenders?.find((person) => person.id === request?.recommender_id);
  const programOf = (request: RequestRow | null) => {
    const application = request ? applicationsById.get(request.application_id) : undefined;
    return application ? applicationName(application) : 'this program';
  };

  return (
    <>
      <PageHeader
        title="Recommenders"
        description="The people writing your letters, and where each one stands."
        actions={
          !loading && recommenders.length > 0 ? (
            <Button variant="primary" onClick={() => setEditingPerson('new')}>
              <Plus aria-hidden="true" className="size-4" />
              Add recommender
            </Button>
          ) : undefined
        }
      />

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

      <RecommenderDialog
        target={editingPerson}
        onClose={() => setEditingPerson(null)}
        onSaved={setNotice}
      />
      <RequestDialog target={requesting} onClose={() => setRequesting(null)} onSaved={setNotice} />
      <DeleteRecommenderDialog
        recommender={personToDelete}
        requestCount={personToDelete ? (lettersByPerson.get(personToDelete.id)?.length ?? 0) : 0}
        onClose={() => setPersonToDelete(null)}
        onDeleted={(person) => {
          setPersonToDelete(null);
          setNotice(`Deleted ${person.name}.`);
        }}
      />
      <DeleteRequestDialog
        request={requestToRemove}
        who={personOf(requestToRemove)?.name ?? 'this recommender'}
        program={programOf(requestToRemove)}
        onClose={() => setRequestToRemove(null)}
        onDeleted={() => {
          const who = personOf(requestToRemove)?.name ?? 'the recommender';
          setRequestToRemove(null);
          setNotice(`Removed the request to ${who}.`);
        }}
      />
    </>
  );
}
