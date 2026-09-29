import { describeOpenDeadline, type DeadlineInfo } from '@/features/applications/dates';
import { formatMoney } from '@/features/applications/money';
import type { ApplicationStatus } from '@/features/applications/status';
import type { Tone } from '@/components/ui/tone';
import { canStillApply, isPursuit, type FundingStatus } from './kinds';
import type { FundingRow } from './types';

// The small rules behind the funding screens: how money is added up, what a program's funding
// looks like at a glance, how a deadline is read, and in what order things are shown. Pure
// functions: no screens, no database.

/** An amount of money in one currency. */
export type MoneyTotal = { currency: string; amount: number };

/**
 * Adds up amounts per currency, never mixing currencies. Sums are done in cents so 0.1 + 0.2 style
 * rounding errors cannot creep in. Items without an amount add nothing.
 */
export function sumByCurrency(
  rows: readonly Pick<FundingRow, 'amount' | 'currency'>[],
): MoneyTotal[] {
  const cents = new Map<string, number>();
  for (const row of rows) {
    if (row.amount === null) continue;
    cents.set(row.currency, (cents.get(row.currency) ?? 0) + Math.round(row.amount * 100));
  }
  return [...cents]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, amount: total / 100 }))
    .filter((total) => total.amount > 0);
}

/** "$20,000", or "$20,000 + £5,000" when the money is in more than one currency. */
export function describeMoney(totals: readonly MoneyTotal[]): string {
  return totals.map((total) => formatMoney(total.amount, total.currency)).join(' + ');
}

export type FundingTotals = {
  /** Money you have said yes to. */
  accepted: MoneyTotal[];
  /** Money that has been offered and is waiting for your answer. */
  offered: MoneyTotal[];
  /** Money you have applied for and are waiting to hear about. */
  waiting: MoneyTotal[];
};

export function totalFunding(rows: readonly FundingRow[]): FundingTotals {
  const of = (status: FundingStatus) => sumByCurrency(rows.filter((row) => row.status === status));
  return { accepted: of('accepted'), offered: of('offered'), waiting: of('applied') };
}

/** True when there is any money to show in the totals. */
export function hasTotals(totals: FundingTotals): boolean {
  return totals.accepted.length + totals.offered.length + totals.waiting.length > 0;
}

/** What one program's funding looks like from the applications list. */
export type ProgramFunding = {
  /** Every item on the program, whatever its status. */
  count: number;
  acceptedCount: number;
  offeredCount: number;
  /** Items still a possibility: researching, applying or waiting to hear. */
  pursuingCount: number;
  accepted: MoneyTotal[];
  offered: MoneyTotal[];
  /** At least one item is offered or accepted (the "funding offered" filter). */
  hasOffer: boolean;
  /** At least one item is still a possibility (the "funding to pursue" filter). */
  pursuing: boolean;
};

export function summarizeProgramFunding(rows: readonly FundingRow[]): ProgramFunding {
  const accepted = rows.filter((row) => row.status === 'accepted');
  const offered = rows.filter((row) => row.status === 'offered');
  const pursuing = rows.filter((row) => isPursuit(row.status));
  return {
    count: rows.length,
    acceptedCount: accepted.length,
    offeredCount: offered.length,
    pursuingCount: pursuing.length,
    accepted: sumByCurrency(accepted),
    offered: sumByCurrency(offered),
    hasOffer: accepted.length + offered.length > 0,
    pursuing: pursuing.length > 0,
  };
}

/** Funding per program. A program with no funding items, and funding tied to none, is not in it. */
export function fundingByApplication(rows: readonly FundingRow[]): Map<string, ProgramFunding> {
  const grouped = new Map<string, FundingRow[]>();
  for (const row of rows) {
    if (row.application_id === null) continue;
    const group = grouped.get(row.application_id);
    if (group) group.push(row);
    else grouped.set(row.application_id, [row]);
  }
  return new Map(
    [...grouped].map(([applicationId, group]) => [applicationId, summarizeProgramFunding(group)]),
  );
}

/** What the list of programs knows about funding: loading, failed, or the numbers. */
export type FundingLookup = {
  status: 'loading' | 'ready' | 'unavailable';
  byApplication: ReadonlyMap<string, ProgramFunding>;
};

export type FundingHeadline = {
  /** "Accepted", "Offered", "2 being pursued" or "None available". */
  label: string;
  /** The money behind the label, when there is any. */
  amount: string | null;
  tone: Tone;
};

/** One program's funding in a few words: the best news first. */
export function describeProgramFunding(funding: ProgramFunding): FundingHeadline {
  if (funding.acceptedCount > 0) {
    return { label: 'Accepted', amount: describeMoney(funding.accepted) || null, tone: 'green' };
  }
  if (funding.offeredCount > 0) {
    return { label: 'Offered', amount: describeMoney(funding.offered) || null, tone: 'violet' };
  }
  if (funding.pursuingCount > 0) {
    return { label: `${funding.pursuingCount} being pursued`, amount: null, tone: 'neutral' };
  }
  return { label: 'None available', amount: null, tone: 'neutral' };
}

/**
 * What an item's deadline means right now. It only matters while you can still apply: once you
 * have applied, been answered, or the program is rejected or withdrawn, it is history and never
 * shown as overdue. Unlike an application deadline, a submitted program does not close it: a
 * scholarship can be due after the application itself is in.
 */
export function fundingDue(
  row: Pick<FundingRow, 'deadline' | 'status'>,
  applicationStatus: ApplicationStatus | null,
  today: string,
): DeadlineInfo {
  if (!row.deadline) return { state: 'none', days: null, text: null, tone: 'neutral' };
  const open = describeOpenDeadline(row.deadline, today);
  if (open.state === 'none') return open;
  const programOver = applicationStatus === 'rejected' || applicationStatus === 'withdrawn';
  return canStillApply(row.status) && !programOver
    ? open
    : { state: 'closed', days: open.days, text: null, tone: 'neutral' };
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const statusOrder = new Map<FundingStatus, number>([
  ['offered', 0],
  ['accepted', 1],
  ['applied', 2],
  ['declined', 3],
  ['rejected', 4],
]);

/**
 * Items in the order to deal with them: the ones you can still apply for first, soonest deadline
 * first (no deadline last); then the rest, offers before everything else.
 */
export function sortFunding(rows: readonly FundingRow[]): FundingRow[] {
  return [...rows].sort((a, b) => {
    const aOpen = canStillApply(a.status);
    if (aOpen !== canStillApply(b.status)) return aOpen ? -1 : 1;
    if (!aOpen) {
      const byStatus = (statusOrder.get(a.status) ?? 0) - (statusOrder.get(b.status) ?? 0);
      if (byStatus !== 0) return byStatus;
    }
    if (a.deadline !== b.deadline) {
      if (a.deadline === null) return 1;
      if (b.deadline === null) return -1;
      return a.deadline < b.deadline ? -1 : 1;
    }
    return (
      collator.compare(a.name, b.name) ||
      collator.compare(a.created_at, b.created_at) ||
      collator.compare(a.id, b.id)
    );
  });
}
