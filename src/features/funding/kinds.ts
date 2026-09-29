import type { Tone } from '@/components/ui/tone';

// What a funding item can be, and where it stands. The values are stored in the database (enums
// `funding_kind` and `funding_status`), so keep them in sync with supabase/migrations.

export const FUNDING_KINDS = [
  { value: 'university_scholarship', label: 'University Scholarship' },
  { value: 'external_scholarship', label: 'External Scholarship' },
  { value: 'fellowship', label: 'Fellowship' },
  { value: 'research_assistantship', label: 'Research Assistantship' },
  { value: 'teaching_assistantship', label: 'Teaching Assistantship' },
  { value: 'tuition_waiver', label: 'Tuition Waiver' },
  { value: 'stipend', label: 'Stipend' },
  { value: 'other', label: 'Other' },
] as const;

export type FundingKind = (typeof FUNDING_KINDS)[number]['value'];
export const FUNDING_KIND_VALUES = FUNDING_KINDS.map((kind) => kind.value);

export function fundingKindLabel(kind: FundingKind): string {
  return FUNDING_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

// The order here is the order of an item's life: found, applied for, answered.
export const FUNDING_STATUSES = [
  { value: 'researching', label: 'Researching', tone: 'neutral' },
  { value: 'applying', label: 'Applying', tone: 'blue' },
  { value: 'applied', label: 'Applied', tone: 'indigo' },
  { value: 'offered', label: 'Offered', tone: 'violet' },
  { value: 'accepted', label: 'Accepted', tone: 'green' },
  { value: 'declined', label: 'Declined', tone: 'neutral' },
  { value: 'rejected', label: 'Rejected', tone: 'red' },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export type FundingStatus = (typeof FUNDING_STATUSES)[number]['value'];
export const FUNDING_STATUS_VALUES = FUNDING_STATUSES.map((status) => status.value);

export function getFundingStatusMeta(status: FundingStatus) {
  const meta = FUNDING_STATUSES.find((item) => item.value === status);
  if (!meta) throw new Error(`Unknown funding status: ${status}`);
  return meta;
}

/** The school (or sponsor) has said yes, whether or not you have said yes back. */
export function isOffer(status: FundingStatus): boolean {
  return status === 'offered' || status === 'accepted';
}

/** Still a possibility: found, being applied for, or waiting to hear. */
export function isPursuit(status: FundingStatus): boolean {
  return status === 'researching' || status === 'applying' || status === 'applied';
}

/** You have not applied yet, so the item's deadline is still something to act on. */
export function canStillApply(status: FundingStatus): boolean {
  return status === 'researching' || status === 'applying';
}
