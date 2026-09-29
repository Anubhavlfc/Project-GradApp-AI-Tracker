import { Card, CardBody, CardHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatMoney, summarizeCosts } from './money';
import type { ApplicationRecord } from './types';

function Amount({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatMoney(value, currency)}</dd>
    </div>
  );
}

/** What the application fees add up to: paid, still to pay, and saved by waivers. */
export function CostSummary({ records }: { records: readonly ApplicationRecord[] }) {
  const summaries = summarizeCosts(records);
  if (summaries.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Application fees"
        description="For all your programs, whatever filters are on."
      />
      <CardBody className="space-y-4">
        {summaries.map((summary) => (
          <div key={summary.currency}>
            {summaries.length > 1 ? (
              <h3 className="mb-2 text-xs font-medium text-fg-muted">{summary.currency}</h3>
            ) : null}
            <dl
              className={cn(
                'grid gap-4 sm:grid-cols-4',
                // Three amounts fit on one row on a phone; four go two by two.
                summary.waived > 0 ? 'grid-cols-2' : 'grid-cols-3',
              )}
            >
              <Amount label="Total" value={summary.total} currency={summary.currency} />
              <Amount label="Paid" value={summary.paid} currency={summary.currency} />
              <Amount label="Still to pay" value={summary.remaining} currency={summary.currency} />
              {summary.waived > 0 ? (
                <Amount
                  label="Saved by waivers"
                  value={summary.waived}
                  currency={summary.currency}
                />
              ) : null}
            </dl>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
