import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  PageHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { PriorityBadge } from '@/features/applications/ApplicationCells';
import { DeleteApplicationDialog } from '@/features/applications/DeleteApplicationDialog';
import { toDataError } from '@/features/applications/errors';
import { FavoriteButton } from '@/features/applications/FavoriteButton';
import { useApplication, useQuickActions } from '@/features/applications/hooks';
import { applicationName, degreeLevelLabel, programLine } from '@/features/applications/labels';
import { StatusMenu } from '@/features/applications/StatusMenu';
import { applicationTabs } from '@/features/applications/tabs';
import { cn } from '@/lib/cn';
import { ApplicationNotFound } from './ApplicationNotFound';

function DetailsSkeleton() {
  return (
    <SkeletonRegion label="Loading program">
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-2 h-8 w-72" />
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </SkeletonRegion>
  );
}

/** Header, status and tabs shared by every section of a program's page. */
export function ApplicationLayout() {
  const { applicationId } = useParams();
  const found = useApplication(applicationId);
  const actions = useQuickActions();
  const navigate = useNavigate();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (found.data === undefined) {
    return found.isError ? (
      <Alert
        kind="danger"
        title="Unable to load this program"
        action={
          <Button size="sm" onClick={() => void found.refetch()}>
            Try again
          </Button>
        }
      >
        {toDataError(found.error).message}
      </Alert>
    ) : (
      <DetailsSkeleton />
    );
  }
  const record = found.data;
  if (record === null) return <ApplicationNotFound />;

  const name = applicationName(record);
  return (
    <>
      <Link
        to="/app/applications"
        className="focus-ring -ml-1 mb-4 inline-flex items-center gap-1 rounded-sm px-1 text-fg-muted hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Applications
      </Link>

      <PageHeader
        title={record.university.name}
        description={programLine(record)}
        actions={
          <>
            <FavoriteButton
              name={name}
              isFavorite={record.is_favorite}
              onToggle={() => actions.toggleFavorite(record)}
            />
            <ButtonLink to={`/app/applications/${record.id}/edit`}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </ButtonLink>
            <Button className="text-tone-red-fg" onClick={() => setConfirmingDelete(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          </>
        }
      />

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusMenu
          status={record.status}
          name={name}
          onChange={(status) => actions.setStatus(record, status)}
        />
        {record.priority ? <PriorityBadge priority={record.priority} /> : null}
        <Badge>{degreeLevelLabel(record.degree_level)}</Badge>
        {record.is_stem ? <Badge>STEM</Badge> : null}
      </div>

      {actions.error ? (
        <div className="mb-4">
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
        </div>
      ) : null}

      {applicationTabs.length > 1 ? (
        <nav aria-label="Sections of this program" className="mb-6 border-b border-border">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {applicationTabs.map((tab) => (
              <li key={tab.label}>
                <NavLink
                  to={tab.to || '.'}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      'focus-ring block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'border-accent text-fg'
                        : 'border-transparent text-fg-muted hover:text-fg',
                    )
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <Outlet context={record} />

      <DeleteApplicationDialog
        record={confirmingDelete ? record : null}
        onClose={() => setConfirmingDelete(false)}
        onDeleted={() =>
          void navigate('/app/applications', { state: { notice: `Deleted ${name}.` } })
        }
      />
    </>
  );
}
