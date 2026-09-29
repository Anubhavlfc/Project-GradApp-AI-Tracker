import { useMemo, useState } from 'react';
import { Coins, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { useToday } from '@/features/applications/useToday';
import { useApplicationsQuery } from '@/features/applications/hooks';
import type { ApplicationRecord } from '@/features/applications/types';
import { DeleteFundingDialog } from '@/features/funding/DeleteFundingDialog';
import { FundingDialog, type FundingTarget } from '@/features/funding/FundingDialog';
import { FundingItem } from '@/features/funding/FundingItem';
import { FundingTotals } from '@/features/funding/FundingTotals';
import { useFundingActions, useSortedFunding } from '@/features/funding/hooks';
import type { FundingRow } from '@/features/funding/types';
import { toDataError } from '@/lib/dataError';

function ListSkeleton() {
  return (
    <SkeletonRegion label="Loading funding">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Every scholarship, fellowship and assistantship you are tracking, across all your programs. */
export function FundingPage() {
  const query = useSortedFunding();
  const applicationsQuery = useApplicationsQuery();
  const actions = useFundingActions();
  const today = useToday();

  const [editing, setEditing] = useState<FundingTarget | null>(null);
  const [toDelete, setToDelete] = useState<FundingRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = query.data;
  const applications = applicationsQuery.data;
  const applicationsById = useMemo(
    () => new Map<string, ApplicationRecord>((applications ?? []).map((item) => [item.id, item])),
    [applications],
  );

  const failed =
    (items === undefined && query.isError) ||
    (applications === undefined && applicationsQuery.isError);
  const loading = items === undefined || applications === undefined;

  function retry() {
    void query.refetch();
    void applicationsQuery.refetch();
  }

  function renderBody() {
    if (loading) {
      return failed ? (
        <Alert
          kind="danger"
          title="Unable to load funding"
          action={
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error ?? applicationsQuery.error).message}
        </Alert>
      ) : (
        <ListSkeleton />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={Coins}
          title="No funding tracked yet."
          description="Record the scholarships, fellowships and assistantships you are pursuing or have been offered, with amounts, deadlines and where each one stands."
          action={
            <Button variant="primary" onClick={() => setEditing({ kind: 'new' })}>
              Add funding
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {query.isError || applicationsQuery.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh funding"
            action={
              <Button size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded.{' '}
            {toDataError(query.error ?? applicationsQuery.error).message}
          </Alert>
        ) : null}

        <FundingTotals items={items} />

        <Card>
          <ul aria-label="Funding" className="divide-y divide-border">
            {items.map((item) => (
              <FundingItem
                key={item.id}
                item={item}
                application={
                  item.application_id ? (applicationsById.get(item.application_id) ?? null) : null
                }
                showProgram
                today={today}
                onChangeStatus={actions.setStatus}
                onEdit={(row) => setEditing({ kind: 'edit', item: row })}
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
      <PageHeader
        title="Funding"
        description="Scholarships, fellowships and assistantships, and where each one stands."
        actions={
          !loading && items.length > 0 ? (
            <Button variant="primary" onClick={() => setEditing({ kind: 'new' })}>
              <Plus aria-hidden="true" className="size-4" />
              Add funding
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
            title="Couldn't update that funding item"
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

      <FundingDialog target={editing} onClose={() => setEditing(null)} onSaved={setNotice} />
      <DeleteFundingDialog
        item={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={(item) => {
          setToDelete(null);
          setNotice(`Deleted ${item.name}.`);
        }}
      />
    </>
  );
}
