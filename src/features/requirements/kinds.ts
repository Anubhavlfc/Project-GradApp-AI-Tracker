import type { Tone } from '@/components/ui/tone';

// What a checklist item can be, and the statuses it moves through. The values are stored in the
// database (enums `requirement_kind` and `requirement_status`), so keep them in sync with
// supabase/migrations. The order here is the order a checklist is shown in.

export const REQUIREMENT_KINDS = [
  { value: 'resume_cv', label: 'Resume / CV' },
  { value: 'statement_of_purpose', label: 'Statement of Purpose' },
  { value: 'personal_statement', label: 'Personal Statement' },
  { value: 'supplemental_essay', label: 'Supplemental Essay' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'gre', label: 'GRE' },
  { value: 'gmat', label: 'GMAT' },
  { value: 'toefl', label: 'TOEFL' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'writing_sample', label: 'Writing Sample' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'recommendation_letter', label: 'Recommendation Letter' },
  { value: 'application_fee', label: 'Application Fee' },
  { value: 'other', label: 'Other' },
] as const;

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number]['value'];
export const REQUIREMENT_KIND_VALUES = REQUIREMENT_KINDS.map((kind) => kind.value);

export function requirementKindLabel(kind: RequirementKind): string {
  return REQUIREMENT_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

/** Position in the list above, for keeping a checklist in a steady order. */
export function requirementKindOrder(kind: RequirementKind): number {
  return REQUIREMENT_KINDS.findIndex((item) => item.value === kind);
}

// "Complete" and "Submitted" both mean there is nothing left to do for that item; Submitted also
// says it has been sent to the school.
export const REQUIREMENT_STATUSES = [
  { value: 'not_started', label: 'Not Started', tone: 'neutral', done: false },
  { value: 'in_progress', label: 'In Progress', tone: 'amber', done: false },
  { value: 'complete', label: 'Complete', tone: 'green', done: true },
  { value: 'submitted', label: 'Submitted', tone: 'teal', done: true },
] as const satisfies readonly { value: string; label: string; tone: Tone; done: boolean }[];

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number]['value'];
export const REQUIREMENT_STATUS_VALUES = REQUIREMENT_STATUSES.map((status) => status.value);

export function getRequirementStatusMeta(status: RequirementStatus) {
  const meta = REQUIREMENT_STATUSES.find((item) => item.value === status);
  if (!meta) throw new Error(`Unknown requirement status: ${status}`);
  return meta;
}

export function isDone(status: RequirementStatus): boolean {
  return getRequirementStatusMeta(status).done;
}

/** One line of the "add common requirements" picker. */
export type CommonRequirement = {
  /** Stable key for the checkbox. */
  id: string;
  kind: RequirementKind;
  /** Set for items that share a kind, so they can be told apart ("Recommendation Letter 2"). */
  label: string | null;
  /** Ticked when the picker opens: what most programs ask for. */
  preselected: boolean;
};

export const COMMON_REQUIREMENTS: readonly CommonRequirement[] = [
  { id: 'resume_cv', kind: 'resume_cv', label: null, preselected: true },
  { id: 'statement_of_purpose', kind: 'statement_of_purpose', label: null, preselected: true },
  { id: 'personal_statement', kind: 'personal_statement', label: null, preselected: false },
  { id: 'supplemental_essay', kind: 'supplemental_essay', label: null, preselected: false },
  { id: 'transcript', kind: 'transcript', label: null, preselected: true },
  { id: 'gre', kind: 'gre', label: null, preselected: false },
  { id: 'gmat', kind: 'gmat', label: null, preselected: false },
  { id: 'toefl', kind: 'toefl', label: null, preselected: false },
  { id: 'ielts', kind: 'ielts', label: null, preselected: false },
  { id: 'writing_sample', kind: 'writing_sample', label: null, preselected: false },
  { id: 'portfolio', kind: 'portfolio', label: null, preselected: false },
  {
    id: 'recommendation_letter_1',
    kind: 'recommendation_letter',
    label: 'Recommendation Letter 1',
    preselected: true,
  },
  {
    id: 'recommendation_letter_2',
    kind: 'recommendation_letter',
    label: 'Recommendation Letter 2',
    preselected: true,
  },
  {
    id: 'recommendation_letter_3',
    kind: 'recommendation_letter',
    label: 'Recommendation Letter 3',
    preselected: true,
  },
  { id: 'application_fee', kind: 'application_fee', label: null, preselected: true },
];
