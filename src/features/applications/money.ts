import type { ApplicationStatus } from './status';
import type { FeeWaiverStatus } from './labels';

const MAX_AMOUNT = 1_000_000;

/** '$90', '$90.50', 'CA$120'. Whole amounts drop the cents. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export type AmountResult = { ok: true; value: number | null } | { ok: false };

// 90, 90.5, 1200, 1,200.50. A lone comma like "90,50" is refused rather than guessed at, because
// in much of Europe it means "ninety and a half" and would otherwise be read as 9,050.
const AMOUNT = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

/** Reads a money amount typed by a person. Empty means "no amount"; anything odd is refused. */
export function parseAmount(text: string): AmountResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!AMOUNT.test(trimmed)) return { ok: false };
  const value = Number(trimmed.replaceAll(',', ''));
  return value <= MAX_AMOUNT ? { ok: true, value } : { ok: false };
}

export type CostFields = {
  status: ApplicationStatus;
  application_fee: number | null;
  fee_currency: string;
  fee_paid_on: string | null;
  fee_waiver_status: FeeWaiverStatus;
};

export type CostSummary = {
  currency: string;
  /** Paid plus still to pay. */
  total: number;
  paid: number;
  remaining: number;
  /** Fees you do not have to pay because a waiver was granted. */
  waived: number;
};

/**
 * Application fees per currency.
 *  - A fee with a granted waiver costs nothing (counted under `waived`).
 *  - A paid fee counts as paid, even if the application was withdrawn afterwards.
 *  - An unpaid fee for a withdrawn application is not going to be paid, so it is left out.
 * Sums are done in cents so 0.1 + 0.2 style rounding errors cannot creep in.
 */
export function summarizeCosts(applications: readonly CostFields[]): CostSummary[] {
  const cents = new Map<string, { paid: number; remaining: number; waived: number }>();
  for (const application of applications) {
    if (!application.application_fee) continue;
    const amount = Math.round(application.application_fee * 100);
    const totals = cents.get(application.fee_currency) ?? { paid: 0, remaining: 0, waived: 0 };
    cents.set(application.fee_currency, totals);

    if (application.fee_waiver_status === 'granted') totals.waived += amount;
    else if (application.fee_paid_on) totals.paid += amount;
    else if (application.status !== 'withdrawn') totals.remaining += amount;
  }
  return [...cents.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, { paid, remaining, waived }]) => ({
      currency,
      total: (paid + remaining) / 100,
      paid: paid / 100,
      remaining: remaining / 100,
      waived: waived / 100,
    }))
    .filter((summary) => summary.total > 0 || summary.waived > 0);
}
