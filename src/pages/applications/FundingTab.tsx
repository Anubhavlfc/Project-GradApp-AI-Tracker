import { useState } from 'react';
import { Coins, Plus } from 'lucide-react';
import { Alert, Button, Card, EmptyState, Skeleton, SkeletonRegion } from '@/components/ui';
import { toISODate } from '@/features/applications/dates';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { DeleteFundingDialog } from '@/features/funding/DeleteFundingDialog';
import { FundingDialog, type FundingTarget } from '@/features/funding/FundingDialog';
import { FundingItem } from '@/features/funding/FundingItem';
import { FundingTotals } from '@/features/funding/FundingTotals';
import { useApplicationFunding, useFundingActions } from '@/features/funding/hooks';
import type { FundingRow } from '@/features/funding/types';
import { toDataError } from '@/lib/dataError';

function FundingSkeleton() {
  return (
    <SkeletonRegion label="Loading funding">
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

/** A program's funding: scholarships, fellowships and assistantships, and where each one stands. */
export function FundingTab() {
  const record = useApplicationRecord();
  const query = useApplicationFunding(record.id);
  const actions = useFundingActions();
  const today = toISODate();

  const [editing, setEditing] = useState<FundingTarget | null>(null);
  const [toDelete, setToDelete] = useState<FundingRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = () => setEditing({ kind: 'new', applicationId: record.id });
  const items = query.data;

  function renderBody() {
    if (items === undefined) {
      return query.isError ? (
        <Alert
          kind="danger"
          title="Unable to load funding"
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error).message}
        </Alert>
      ) : (
        <FundingSkeleton />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={Coins}
          title="No funding tracked yet."
          description="Record the scholarships, fellowships and assistantships for this program, with amounts, deadlines and where each one stands."
          action={
            <Button variant="primary" onClick={add}>
              Add funding
            </Button>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {query.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh funding"
            action={
              <Button size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded. {toDataError(query.error).message}
          </Alert>
        ) : null}

        <FundingTotals items={items} />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Funding</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                What could pay for this program, and where each item stands.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={add}>
              <Plus aria-hidden="true" className="size-4" />
              Add funding
            </Button>
          </div>
          <ul aria-label="Funding" className="divide-y divide-border">
            {items.map((item) => (
              <FundingItem
                key={item.id}
                item={item}
                application={record}
                showProgram={false}
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
