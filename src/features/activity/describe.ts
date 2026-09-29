import { APPLICATION_STATUSES } from '@/features/applications/status';
import { FUNDING_STATUSES } from '@/features/funding/kinds';
import { RECOMMENDATION_STATUSES } from '@/features/recommendations/statuses';
import { REQUIREMENT_KIND_VALUES, REQUIREMENT_STATUSES } from '@/features/requirements/kinds';
import type { RequirementKind } from '@/features/requirements/kinds';
import { requirementTitle } from '@/features/requirements/progress';
import { isActivityKind } from './kinds';
import type { ActivityRow } from './types';

// Turns a row of the activity log into words. The database keeps the facts (a kind, a subject, the
// new status, a few extra values); this is the one place that decides how they read.

export type ActivityDescription = {
  /** What happened: "GRE marked Complete". */
  headline: string;
  /** What it happened to, when the headline does not say: the program's name. */
  context: string | null;
  /** Where to see it. Null when there is nowhere to go, such as a program that was removed. */
  href: string | null;
};

function labelOf(list: readonly { value: string; label: string }[], value: string | null) {
  return list.find((item) => item.value === value)?.label ?? null;
}

/** A text value from the entry's extra words, or null when it is missing or not text. */
function metaText(row: ActivityRow, key: string): string | null {
  const value = row.meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function programPath(row: ActivityRow, tab?: string): string | null {
  if (!row.application_id) return null;
  return tab
    ? `/app/applications/${row.application_id}/${tab}`
    : `/app/applications/${row.application_id}`;
}

/** "{thing} marked {status}", or "{thing} updated" when the status is not one we know. */
function marked(
  thing: string,
  statuses: readonly { value: string; label: string }[],
  row: ActivityRow,
) {
  const label = labelOf(statuses, row.detail);
  return label ? `${thing} marked ${label}` : `${thing} updated`;
}

function requirementName(row: ActivityRow): string {
  const kind = metaText(row, 'requirement');
  if (!kind || !(REQUIREMENT_KIND_VALUES as readonly string[]).includes(kind)) {
    return 'A checklist item';
  }
  return requirementTitle({ kind: kind as RequirementKind, label: metaText(row, 'label') });
}

export function describeActivity(row: ActivityRow): ActivityDescription {
  if (!isActivityKind(row.kind)) {
    return { headline: row.subject || 'Something changed', context: null, href: null };
  }

  switch (row.kind) {
    case 'application_added':
      return { headline: 'Added a program', context: row.subject, href: programPath(row) };

    case 'status_changed': {
      const label = labelOf(APPLICATION_STATUSES, row.detail);
      return {
        headline: label ? `Status changed to ${label}` : 'Status changed',
        context: row.subject,
        href: programPath(row),
      };
    }

    case 'application_removed':
      return { headline: 'Removed a program', context: row.subject, href: null };

    case 'requirement_updated':
      return {
        headline: marked(requirementName(row), REQUIREMENT_STATUSES, row),
        context: row.subject,
        href: programPath(row, 'requirements'),
      };

    case 'letter_updated': {
      const person = metaText(row, 'recommender');
      return {
        headline: marked(
          person ? `Letter from ${person}` : 'A letter',
          RECOMMENDATION_STATUSES,
          row,
        ),
        context: row.subject,
        href: programPath(row, 'recommendations'),
      };
    }

    case 'funding_updated':
      return {
        headline: marked(row.subject, FUNDING_STATUSES, row),
        context: metaText(row, 'program'),
        href: programPath(row, 'funding') ?? '/app/funding',
      };

    case 'task_completed':
      return {
        headline: `Completed “${row.subject}”`,
        context: metaText(row, 'program'),
        href: programPath(row, 'tasks') ?? '/app/tasks',
      };

    case 'document_completed':
      return { headline: `Finished “${row.subject}”`, context: null, href: '/app/documents' };
  }
}
