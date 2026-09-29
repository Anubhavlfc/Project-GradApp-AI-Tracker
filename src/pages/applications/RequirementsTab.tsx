import { useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
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
import { toDataError } from '@/lib/dataError';
import { applicationName } from '@/features/applications/labels';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { CommonRequirementsDialog } from '@/features/requirements/CommonRequirementsDialog';
import { CompletionSummary } from '@/features/requirements/CompletionMeter';
import { DeleteRequirementDialog } from '@/features/requirements/DeleteRequirementDialog';
import { useApplicationRequirements, useRequirementActions } from '@/features/requirements/hooks';
import { requirementTitle, summarize } from '@/features/requirements/progress';
import {
  RequirementDialog,
  type RequirementTarget,
} from '@/features/requirements/RequirementDialog';
import { RequirementItem } from '@/features/requirements/RequirementItem';
import type { RequirementRow } from '@/features/requirements/types';

const NO_ITEMS: RequirementRow[] = [];

function ChecklistSkeleton() {
  return (
    <SkeletonRegion label="Loading requirements">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** A program's checklist: everything it asks for, how far along each item is, and the total. */
export function RequirementsTab() {
  const record = useApplicationRecord();
  const query = useApplicationRequirements(record.id);
  const actions = useRequirementActions();
  const today = toISODate();
  const name = applicationName(record);

  const [editing, setEditing] = useState<RequirementTarget | null>(null);
  const [picking, setPicking] = useState(false);
  const [toDelete, setToDelete] = useState<RequirementRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = query.data ?? NO_ITEMS;
  const completion = summarize(items);

  function renderBody() {
    if (query.data === undefined) {
      return query.isError ? (
        <Alert
          kind="danger"
          title="Unable to load requirements"
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error).message}
        </Alert>
      ) : (
        <ChecklistSkeleton />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={ListChecks}
          title="No requirements yet."
          description="Add what this program asks for (essays, transcripts, test scores, letters) and tick items off as you go."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setPicking(true)}>
                Add common requirements
              </Button>
              <Button onClick={() => setEditing('new')}>Add requirement</Button>
            </div>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {query.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh requirements"
            action={
              <Button size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            Showing the last checklist that loaded. {toDataError(query.error).message}
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="Progress" />
          <CardBody>
            <CompletionSummary completion={completion} name={name} />
            {/* Says the new total out loud after a change, since the row itself only changes colour. */}
            <p aria-live="polite" className="sr-only">
              {completion.percent === null
                ? ''
                : `${completion.done} of ${completion.total} required items done.`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Checklist</h2>
              <p className="mt-0.5 text-xs text-fg-muted">What this program asks you to provide.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setPicking(true)}>
                Add common requirements
              </Button>
              <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
                <Plus aria-hidden="true" className="size-4" />
                Add requirement
              </Button>
            </div>
          </div>
          <ul aria-label="Requirements" className="divide-y divide-border">
            {items.map((row) => (
              <RequirementItem
                key={row.id}
                row={row}
                applicationStatus={record.status}
                today={today}
                onChangeStatus={actions.setStatus}
                onEdit={setEditing}
                onDelete={setToDelete}
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
            title="Couldn't update that requirement"
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

      <RequirementDialog
        target={editing}
        applicationId={record.id}
        items={items}
        onClose={() => setEditing(null)}
        onSaved={setNotice}
      />
      <CommonRequirementsDialog
        open={picking}
        applicationId={record.id}
        items={items}
        onClose={() => setPicking(false)}
        onAdded={setNotice}
      />
      <DeleteRequirementDialog
        row={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={(row) => {
          setToDelete(null);
          setNotice(`Deleted ${requirementTitle(row)}.`);
        }}
      />
    </>
  );
}
