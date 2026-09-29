import type { RequirementKind } from '@/features/requirements/kinds';
import { percentOf, sortRequirements } from '@/features/requirements/progress';
import type { RequirementRow } from '@/features/requirements/types';
import { documentKindOrder, documentKindsFor, isDocumentRequirement } from './kinds';
import type { DocumentRow } from './types';

// The small rules behind the document screens: how far along the documents are, in what order they
// are shown, which checklist items can use a document, and which documents suit which item. Pure
// functions: no screens, no database.

export type DocumentProgress = {
  total: number;
  complete: number;
  inProgress: number;
  notStarted: number;
  /** complete / total as a whole percent; null while there are no documents. */
  percent: number | null;
};

export function summarizeDocuments(rows: readonly Pick<DocumentRow, 'status'>[]): DocumentProgress {
  let complete = 0;
  let inProgress = 0;
  let notStarted = 0;
  for (const row of rows) {
    if (row.status === 'complete') complete += 1;
    else if (row.status === 'in_progress') inProgress += 1;
    else notStarted += 1;
  }
  return {
    total: rows.length,
    complete,
    inProgress,
    notStarted,
    percent: percentOf(complete, rows.length),
  };
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** A steady order: by type, then by name ("Draft 2" before "Draft 10"), then oldest first. */
export function sortDocuments(rows: readonly DocumentRow[]): DocumentRow[] {
  return [...rows].sort(
    (a, b) =>
      documentKindOrder(a.kind) - documentKindOrder(b.kind) ||
      collator.compare(a.name, b.name) ||
      collator.compare(a.created_at, b.created_at) ||
      collator.compare(a.id, b.id),
  );
}

/** How many checklist items use each document. A document used nowhere is not in the map. */
export function documentUsage(
  rows: readonly Pick<RequirementRow, 'document_id'>[],
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const row of rows) {
    if (row.document_id !== null) usage.set(row.document_id, (usage.get(row.document_id) ?? 0) + 1);
  }
  return usage;
}

/** What the rest of the app knows about where documents are used: loading, failed, or the counts. */
export type UsageLookup = {
  status: 'loading' | 'ready' | 'unavailable';
  byDocument: ReadonlyMap<string, number>;
};

/** A program's checklist items that a document can be attached to, in checklist order. */
export function documentItems(rows: readonly RequirementRow[]): RequirementRow[] {
  return sortRequirements(rows.filter((row) => isDocumentRequirement(row.kind)));
}

export type LinkOptions = {
  /** Documents of a kind that fits the checklist item, the best fit first. */
  suggested: DocumentRow[];
  /** Everything else: any document can be used for any item. */
  others: DocumentRow[];
};

/** The documents to offer for a checklist item: the ones that suit its kind first. */
export function linkOptions(kind: RequirementKind, documents: readonly DocumentRow[]): LinkOptions {
  const fits = isDocumentRequirement(kind) ? documentKindsFor(kind) : [];
  const rank = (document: DocumentRow) => fits.indexOf(document.kind);
  const sorted = sortDocuments(documents);
  return {
    suggested: sorted.filter((document) => rank(document) >= 0).sort((a, b) => rank(a) - rank(b)),
    others: sorted.filter((document) => rank(document) < 0),
  };
}
