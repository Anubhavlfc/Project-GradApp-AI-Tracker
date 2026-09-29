import { z } from 'zod';
import { RECOMMENDATION_STATUS_VALUES } from './statuses';

// The shapes the database returns. Every row is checked against these when it arrives, so a
// mismatch between the schema and the app fails loudly here instead of as "undefined" on screen.
// Column names stay snake_case, exactly as stored.

export const recommenderRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  institution: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RecommenderRow = z.infer<typeof recommenderRowSchema>;

/** What the recommender form submits: the editable parts of a person. */
export type RecommenderFields = Pick<
  RecommenderRow,
  'name' | 'title' | 'institution' | 'email' | 'notes'
>;

/** One recommender's letter for one program. */
export const requestRowSchema = z.object({
  id: z.string(),
  recommender_id: z.string(),
  application_id: z.string(),
  status: z.enum(RECOMMENDATION_STATUS_VALUES),
  requested_on: z.string().nullable(),
  deadline: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RequestRow = z.infer<typeof requestRowSchema>;

/** What the request form submits: everything about a request except who and which program. */
export type RequestFields = Pick<RequestRow, 'status' | 'requested_on' | 'deadline' | 'notes'>;

/** A new request also says whose letter it is and for which program. */
export type NewRequest = RequestFields & Pick<RequestRow, 'recommender_id' | 'application_id'>;
