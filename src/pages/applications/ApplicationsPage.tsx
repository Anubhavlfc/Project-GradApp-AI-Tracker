import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Plus, SearchX } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { ApplicationCards } from '@/features/applications/ApplicationCards';
import { ApplicationsTable } from '@/features/applications/ApplicationsTable';
import { ApplicationToolbar } from '@/features/applications/ApplicationToolbar';
import { CostSummary } from '@/features/applications/CostSummary';
import { toISODate } from '@/features/applications/dates';
import { DeleteApplicationDialog } from '@/features/applications/DeleteApplicationDialog';
import { toDataError } from '@/lib/dataError';
import { useApplicationsQuery, useQuickActions } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import type { ApplicationRecord } from '@/features/applications/types';
import {
  applyView,
  clearFilters,
  DEFAULT_DIRECTION,
  parseView,
  serializeView,
  usedCountries,
  type SortKey,
  type ViewUpdate,
} from '@/features/applications/view';
import { useProgressLookup } from '@/features/requirements/hooks';
import { useMediaQuery } from '@/lib/useMediaQuery';

const NO_RECORDS: ApplicationRecord[] = [];

/** A message handed over by the page we came from, e.g. "Deleted ..." after removing a program. */
function noticeFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  return typeof state.notice === 'string' ? state.notice : null;
}

function ListSkeleton() {
  return (
    <SkeletonRegion label="Loading applications">
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function ApplicationsPage() {
  const query = useApplicationsQuery();
  const actions = useQuickActions();
  const progress = useProgressLookup();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isPhone = useMediaQuery('(max-width: 767px)');
  const [notice, setNotice] = useState(() => noticeFrom(location.state));
  const [toDelete, setToDelete] = useState<ApplicationRecord | null>(null);

  // Forget the notice in the browser history too, so reloading doesn't bring it back.
  useEffect(() => {
    if (noticeFrom(location.state)) void navigate(location, { replace: true, state: null });
  }, [location, navigate]);

  const view = useMemo(() => parseView(params), [params]);

  // The address takes a moment to catch up with a change, so every change is applied to the newest
  // view rather than the one this render saw. Otherwise two quick changes undo each other, and a
  // double click on a toggle switches it on twice instead of on and off.
  const newestView = useRef(view);
  useEffect(() => {
    newestView.current = view;
  }, [view]);
  const updateView = (update: ViewUpdate) => {
    const next = update(newestView.current);
    newestView.current = next;
    setParams(serializeView(next), { replace: true });
  };
  const sortBy = (key: SortKey) =>
    updateView((current) =>
      current.sort === key
        ? { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { ...current, sort: key, direction: DEFAULT_DIRECTION[key] },
    );

  const records = query.data ?? NO_RECORDS;
  const today = toISODate();
  const visible = useMemo(
    () => applyView(records, view, today, progress.byApplication),
    [records, view, today, progress.byApplication],
  );

  const listActions = {
    onToggleFavorite: actions.toggleFavorite,
    onChangeStatus: actions.setStatus,
    onDelete: setToDelete,
  };

  function renderBody() {
    if (query.data === undefined) {
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
        <ListSkeleton />
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

    return (
      <div className="space-y-4">
        {query.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh programs"
            action={
              <Button size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded. {toDataError(query.error).message}
          </Alert>
        ) : null}

        {progress.status === 'unavailable' ? (
          <Alert
            kind="warning"
            title="Unable to load requirement progress"
            action={
              <Button size="sm" onClick={progress.retry}>
                Try again
              </Button>
            }
          >
            Your programs are shown, but how far along each checklist is can't be loaded right now.
          </Alert>
        ) : null}

        <ApplicationToolbar view={view} countries={usedCountries(records)} onChange={updateView} />

        <p aria-live="polite" className="text-xs text-fg-muted">
          {visible.length === records.length
            ? `${records.length} ${records.length === 1 ? 'program' : 'programs'}`
            : `Showing ${visible.length} of ${records.length} programs`}
        </p>

        {visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No programs match."
            description="Try a different search, or clear the filters to see everything."
            action={<Button onClick={() => updateView(clearFilters)}>Clear filters</Button>}
          />
        ) : isPhone ? (
          <ApplicationCards records={visible} today={today} progress={progress} {...listActions} />
        ) : (
          <ApplicationsTable
            records={visible}
            view={view}
            today={today}
            progress={progress}
            onSort={sortBy}
            {...listActions}
          />
        )}

        <CostSummary records={records} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every program you're tracking, with its deadline, status and fee."
        actions={
          records.length > 0 ? (
            <ButtonLink to="/app/applications/new" variant="primary">
              <Plus aria-hidden="true" className="size-4" />
              Add program
            </ButtonLink>
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
            title="Couldn't update that program"
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

      <DeleteApplicationDialog
        record={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={(record) => {
          setToDelete(null);
          setNotice(`Deleted ${applicationName(record)}.`);
        }}
      />
    </>
  );
}
