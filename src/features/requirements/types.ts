import { z } from 'zod';
import { REQUIREMENT_KIND_VALUES, REQUIREMENT_STATUS_VALUES } from './kinds';

// The shape the database returns for one checklist item. Every row is checked against this when it
// arrives, so a mismatch between the schema and the app fails loudly here instead of as
// "undefined" on screen. Column names stay snake_case, exactly as stored.
export const requirementRowSchema = z.object({
  id: z.string(),
  application_id: z.string(),
  kind: z.enum(REQUIREMENT_KIND_VALUES),
  label: z.string().nullable(),
  is_required: z.boolean(),
  status: z.enum(REQUIREMENT_STATUS_VALUES),
  due_date: z.string().nullable(),
  document_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type RequirementRow = z.infer<typeof requirementRowSchema>;

/** What the add/edit form submits: the editable parts of an item. */
export type RequirementFields = Pick<
  RequirementRow,
  'kind' | 'label' | 'is_required' | 'status' | 'due_date' | 'notes'
>;
