import { z } from 'zod';
import { optionalDate, optionalText, requiredText } from '@/features/applications/form';
import { RECOMMENDATION_STATUS_VALUES } from './statuses';
import type { RecommenderFields, RecommenderRow, RequestFields, RequestRow } from './types';

// The two forms of this feature. The browser gives us every field as a string, so this file has
// two jobs for each: turn those strings into typed fields (or a message per field), and turn a
// saved row back into strings for the form to show.

// Deliberately loose (something@something.something): the database checks the same shape, and
// real addresses are checked by sending mail to them, not by a clever pattern.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const MAX_EMAIL_LENGTH = 254;

export function optionalEmail() {
  return z
    .string()
    .trim()
    .default('')
    .transform((value, ctx) => {
      if (value === '') return null;
      if (value.length > MAX_EMAIL_LENGTH || !EMAIL.test(value)) {
        ctx.issues.push({
          code: 'custom',
          message: 'Enter an email address, like name@university.edu.',
          input: value,
        });
        return z.NEVER;
      }
      return value;
    });
}

const recommenderShape = {
  name: requiredText('Name', "Enter the recommender's name.", 200),
  title: optionalText('Title', 200),
  institution: optionalText('Institution', 200),
  email: optionalEmail(),
  notes: optionalText('Notes', 10_000),
};

export const recommenderFormSchema = z.object(recommenderShape) satisfies z.ZodType<
  RecommenderFields,
  unknown
>;

export type RecommenderFormValues = { [K in keyof RecommenderFields]-?: string };

export function emptyRecommenderValues(): RecommenderFormValues {
  return { name: '', title: '', institution: '', email: '', notes: '' };
}

export function recommenderValuesFromRow(row: RecommenderRow): RecommenderFormValues {
  return {
    name: row.name,
    title: row.title ?? '',
    institution: row.institution ?? '',
    email: row.email ?? '',
    notes: row.notes ?? '',
  };
}

// ---------------------------------------------------------------------------------------------

/** The value of the recommender picker that means "someone who is not on the list yet". */
export const NEW_RECOMMENDER = 'new';

const requestShape = {
  status: z.enum(RECOMMENDATION_STATUS_VALUES, { error: 'Choose a status.' }),
  requested_on: optionalDate('Enter a valid date.'),
  deadline: optionalDate('Enter a valid deadline.'),
  notes: optionalText('Notes', 10_000),
};

/** Who wrote (or will write) the letter: someone already on the list, or a person to add. */
export type RequestWriter =
  { kind: 'existing'; recommenderId: string } | { kind: 'new'; fields: RecommenderFields };

export type RequestFormData = {
  writer: RequestWriter;
  applicationId: string;
  fields: RequestFields;
};

// The request dialog has the recommender picker, the fields of a new recommender (`new_*`, used
// only when "New recommender" is picked), and the program picker on top of the fields above.
export const requestFormSchema = z
  .object({
    recommender_id: z.string().trim().default(''),
    application_id: z.string().trim().default(''),
    new_name: z.string().default(''),
    new_title: z.string().default(''),
    new_institution: z.string().default(''),
    new_email: z.string().default(''),
    ...requestShape,
  })
  .transform((values, ctx): RequestFormData => {
    let writer: RequestWriter | null = null;
    if (values.recommender_id === NEW_RECOMMENDER) {
      const person = recommenderFormSchema.safeParse({
        name: values.new_name,
        title: values.new_title,
        institution: values.new_institution,
        email: values.new_email,
      });
      if (person.success) {
        writer = { kind: 'new', fields: person.data };
      } else {
        for (const issue of person.error.issues) {
          ctx.issues.push({
            code: 'custom',
            path: [`new_${String(issue.path[0])}`],
            message: issue.message,
            input: values,
          });
        }
      }
    } else if (values.recommender_id === '') {
      ctx.issues.push({
        code: 'custom',
        path: ['recommender_id'],
        message: 'Choose who is writing the letter.',
        input: values,
      });
    } else {
      writer = { kind: 'existing', recommenderId: values.recommender_id };
    }
    if (values.application_id === '') {
      ctx.issues.push({
        code: 'custom',
        path: ['application_id'],
        message: 'Choose a program.',
        input: values,
      });
    }
    if (!writer || values.application_id === '') return z.NEVER;
    return {
      writer,
      applicationId: values.application_id,
      fields: {
        status: values.status,
        requested_on: values.requested_on,
        deadline: values.deadline,
        notes: values.notes,
      },
    };
  });

export type RequestFormValues = { [K in keyof RequestFields]-?: string };

export function emptyRequestValues(deadline = ''): RequestFormValues {
  return { status: 'not_requested', requested_on: '', deadline, notes: '' };
}

export function requestValuesFromRow(row: RequestRow): RequestFormValues {
  return {
    status: row.status,
    requested_on: row.requested_on ?? '',
    deadline: row.deadline ?? '',
    notes: row.notes ?? '',
  };
}
