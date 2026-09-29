import type { Tone } from '@/components/ui/tone';
import type { RequirementKind } from '@/features/requirements/kinds';

// What a document can be, and how far along it is. The values are stored in the database (enums
// `document_kind` and `document_status`), so keep them in sync with supabase/migrations. The order
// here is the order documents are listed in.

export const DOCUMENT_KINDS = [
  { value: 'resume', label: 'Resume' },
  { value: 'cv', label: 'CV' },
  { value: 'statement_of_purpose', label: 'Statement of Purpose' },
  { value: 'personal_statement', label: 'Personal Statement' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'writing_sample', label: 'Writing Sample' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'gre_score', label: 'GRE Score' },
  { value: 'toefl_score', label: 'TOEFL Score' },
  { value: 'ielts_score', label: 'IELTS Score' },
  { value: 'other', label: 'Other' },
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]['value'];
export const DOCUMENT_KIND_VALUES = DOCUMENT_KINDS.map((kind) => kind.value);

export function documentKindLabel(kind: DocumentKind): string {
  return DOCUMENT_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

/** Position in the list above, for keeping documents in a steady order. */
export function documentKindOrder(kind: DocumentKind): number {
  return DOCUMENT_KINDS.findIndex((item) => item.value === kind);
}

export const DOCUMENT_STATUSES = [
  { value: 'not_started', label: 'Not Started', tone: 'neutral' },
  { value: 'in_progress', label: 'In Progress', tone: 'amber' },
  { value: 'complete', label: 'Complete', tone: 'green' },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]['value'];
export const DOCUMENT_STATUS_VALUES = DOCUMENT_STATUSES.map((status) => status.value);

export function getDocumentStatusMeta(status: DocumentStatus) {
  const meta = DOCUMENT_STATUSES.find((item) => item.value === status);
  if (!meta) throw new Error(`Unknown document status: ${status}`);
  return meta;
}

/**
 * The checklist items a document can be used for, with the kinds of document that fit each best.
 * Recommendation letters and application fees are not documents of yours: letters have their own
 * screens and a fee is paid, not attached.
 */
const FITS = {
  resume_cv: ['resume', 'cv'],
  statement_of_purpose: ['statement_of_purpose', 'personal_statement'],
  personal_statement: ['personal_statement', 'statement_of_purpose'],
  supplemental_essay: ['other', 'personal_statement', 'statement_of_purpose'],
  transcript: ['transcript'],
  gre: ['gre_score'],
  gmat: ['other'],
  toefl: ['toefl_score'],
  ielts: ['ielts_score'],
  writing_sample: ['writing_sample'],
  portfolio: ['portfolio'],
  other: [],
} as const satisfies Partial<Record<RequirementKind, readonly DocumentKind[]>>;

export type DocumentRequirementKind = keyof typeof FITS;

/** True for checklist items a document can be attached to. */
export function isDocumentRequirement(kind: RequirementKind): kind is DocumentRequirementKind {
  return kind in FITS;
}

/** The kinds of document that fit a checklist item, best fit first. */
export function documentKindsFor(kind: DocumentRequirementKind): readonly DocumentKind[] {
  return FITS[kind];
}

/** One line of the "add the usual documents" picker. */
export type CommonDocument = {
  /** Stable key for the checkbox. */
  id: string;
  kind: DocumentKind;
  name: string;
  /** Ticked when the picker opens: what nearly every application needs. */
  preselected: boolean;
};

export const COMMON_DOCUMENTS: readonly CommonDocument[] = [
  { id: 'resume', kind: 'resume', name: 'Resume', preselected: true },
  { id: 'cv', kind: 'cv', name: 'CV', preselected: false },
  {
    id: 'statement_of_purpose',
    kind: 'statement_of_purpose',
    name: 'Statement of Purpose',
    preselected: true,
  },
  {
    id: 'personal_statement',
    kind: 'personal_statement',
    name: 'Personal Statement',
    preselected: false,
  },
  { id: 'transcript', kind: 'transcript', name: 'Transcript', preselected: true },
  { id: 'writing_sample', kind: 'writing_sample', name: 'Writing Sample', preselected: false },
  { id: 'portfolio', kind: 'portfolio', name: 'Portfolio', preselected: false },
  { id: 'gre_score', kind: 'gre_score', name: 'GRE Score Report', preselected: false },
  { id: 'toefl_score', kind: 'toefl_score', name: 'TOEFL Score Report', preselected: false },
  { id: 'ielts_score', kind: 'ielts_score', name: 'IELTS Score Report', preselected: false },
];
