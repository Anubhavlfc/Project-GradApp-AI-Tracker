import { z } from 'zod';
import { FUNDING_KIND_VALUES, FUNDING_STATUS_VALUES } from './kinds';

// The shape the database returns for one funding item. Every row is checked against this when it
// arrives, so a mismatch between the schema and the app fails loudly here instead of as
// "undefined" on screen. Column names stay snake_case, exactly as stored.
export const fundingRowSchema = z.object({
  id: z.string(),
  /** The program it belongs to; null for funding that is not tied to one (an outside scholarship). */
  application_id: z.string().nullable(),
  name: z.string(),
  kind: z.enum(FUNDING_KIND_VALUES),
  amount: z.number().nullable(),
  currency: z.string(),
  deadline: z.string().nullable(),
  application_required: z.boolean(),
  status: z.enum(FUNDING_STATUS_VALUES),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type FundingRow = z.infer<typeof fundingRowSchema>;

/** What the add/edit form submits: everything about an item that a person can change. */
export type FundingFields = Pick<
  FundingRow,
  | 'application_id'
  | 'name'
  | 'kind'
  | 'amount'
  | 'currency'
  | 'deadline'
  | 'application_required'
  | 'status'
  | 'url'
  | 'notes'
>;
