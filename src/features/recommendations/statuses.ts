import type { Tone } from '@/components/ui/tone';

// Where a recommendation letter stands. The values are stored in the database (enum
// `recommendation_status`), so keep them in sync with supabase/migrations. The order here is the
// order of a letter's life: asked, agreed, sent.
export const RECOMMENDATION_STATUSES = [
  { value: 'not_requested', label: 'Not Requested', tone: 'neutral' },
  { value: 'requested', label: 'Requested', tone: 'blue' },
  { value: 'confirmed', label: 'Confirmed', tone: 'indigo' },
  { value: 'submitted', label: 'Submitted', tone: 'green' },
  { value: 'needs_follow_up', label: 'Needs Follow-Up', tone: 'amber' },
] as const satisfies readonly { value: string; label: string; tone: Tone }[];

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number]['value'];
export const RECOMMENDATION_STATUS_VALUES = RECOMMENDATION_STATUSES.map((status) => status.value);

export function getRecommendationStatusMeta(status: RecommendationStatus) {
  const meta = RECOMMENDATION_STATUSES.find((item) => item.value === status);
  if (!meta) throw new Error(`Unknown recommendation status: ${status}`);
  return meta;
}

/** The letter has reached the school: nothing is left to chase. */
export function isLetterSent(status: RecommendationStatus): boolean {
  return status === 'submitted';
}
