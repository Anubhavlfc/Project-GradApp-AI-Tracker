import { z } from 'zod';
import { DEGREE_LEVEL_VALUES, FEE_WAIVER_VALUES, PRIORITY_VALUES } from './labels';
import { STATUS_VALUES } from './status';

// The shapes the database returns. Every row is checked against these when it arrives, so a
// mismatch between the schema and the app fails loudly here instead of as "undefined" on screen.
// Column names stay snake_case, exactly as stored.

export const universityRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  website_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const applicationRowSchema = z.object({
  id: z.string(),
  university_id: z.string(),
  school_college: z.string().nullable(),
  department: z.string().nullable(),
  program_name: z.string(),
  degree_level: z.enum(DEGREE_LEVEL_VALUES),
  degree_type: z.string().nullable(),
  program_url: z.string().nullable(),
  program_length_months: z.number().nullable(),
  is_stem: z.boolean(),
  status: z.enum(STATUS_VALUES),
  priority: z.enum(PRIORITY_VALUES).nullable(),
  is_favorite: z.boolean(),
  deadline: z.string().nullable(),
  priority_deadline: z.string().nullable(),
  portal_url: z.string().nullable(),
  interview_at: z.string().nullable(),
  submitted_on: z.string().nullable(),
  application_fee: z.number().nullable(),
  fee_currency: z.string(),
  fee_waiver_available: z.boolean(),
  fee_waiver_status: z.enum(FEE_WAIVER_VALUES),
  fee_paid_on: z.string().nullable(),
  decision_received_on: z.string().nullable(),
  decision_deadline: z.string().nullable(),
  enrollment_deposit: z.number().nullable(),
  is_final_choice: z.boolean(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** One tracked program together with its university: what every screen works with. */
export const applicationRecordSchema = applicationRowSchema.extend({
  university: universityRowSchema,
});

export type UniversityRow = z.infer<typeof universityRowSchema>;
export type ApplicationRow = z.infer<typeof applicationRowSchema>;
export type ApplicationRecord = z.infer<typeof applicationRecordSchema>;

// What the form submits: the editable parts only. Favorite is a quick action, not a form field.

export type UniversityInput = Pick<
  UniversityRow,
  'name' | 'city' | 'region' | 'country' | 'website_url'
>;

export type ApplicationFields = Pick<
  ApplicationRow,
  | 'school_college'
  | 'department'
  | 'program_name'
  | 'degree_level'
  | 'degree_type'
  | 'program_url'
  | 'program_length_months'
  | 'is_stem'
  | 'status'
  | 'priority'
  | 'deadline'
  | 'priority_deadline'
  | 'portal_url'
  | 'interview_at'
  | 'submitted_on'
  | 'application_fee'
  | 'fee_currency'
  | 'fee_waiver_available'
  | 'fee_waiver_status'
  | 'fee_paid_on'
  | 'decision_received_on'
  | 'decision_deadline'
  | 'enrollment_deposit'
  | 'is_final_choice'
  | 'notes'
>;

export type ApplicationInput = { university: UniversityInput; application: ApplicationFields };
