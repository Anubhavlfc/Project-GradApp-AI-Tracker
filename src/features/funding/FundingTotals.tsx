import { Card, CardBody, CardHeader } from '@/components/ui';
import { NotSet } from '@/features/applications/ApplicationCells';
import { describeMoney, hasTotals, totalFunding, type MoneyTotal } from './logic';
import type { FundingRow } from './types';

function Amount({ label, totals }: { label: string; totals: readonly MoneyTotal[] }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-lg font-semibold tabular-nums">
        {totals.length > 0 ? describeMoney(totals) : <NotSet />}
      </dd>
    </div>
  );
}

/** What the funding adds up to: yes, on the table, and still to hear. Nothing when no amounts. */
export function FundingTotals({ items }: { items: readonly FundingRow[] }) {
  const totals = totalFunding(items);
  if (!hasTotals(totals)) return null;
  return (
    <Card>
      <CardHeader
        title="Funding at a glance"
        description="Amounts are added up per currency. Items without an amount are not counted."
      />
      <CardBody>
        <dl className="grid grid-cols-3 gap-4">
          <Amount label="Accepted" totals={totals.accepted} />
          <Amount label="Offered" totals={totals.offered} />
          <Amount label="Waiting to hear" totals={totals.waiting} />
        </dl>
      </CardBody>
    </Card>
  );
}
