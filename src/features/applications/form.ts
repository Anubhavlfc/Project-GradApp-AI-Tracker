import { z } from 'zod';
import { normalizeUrl } from '@/lib/url';
import { daysBetween, fromDateTimeLocal, toDateTimeLocal } from './dates';
import { DEGREE_LEVEL_VALUES, FEE_WAIVER_VALUES, PRIORITY_VALUES } from './labels';
import { parseAmount } from './money';
import { STATUS_VALUES } from './status';
import type { ApplicationInput, ApplicationRecord } from './types';

// The add/edit form. The browser gives us every field as a string, so this file has the two
// jobs: turn those strings into a typed ApplicationInput (or a message per field), and turn a
// saved record back into strings for the form to show.

const emptyToNull = (value: string) => (value === '' ? null : value);

/** Optional text: trimmed, line endings normalised, empty becomes null. */
export function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .default('')
    .transform((value) => emptyToNull(value.replace(/\r\n?/g, '\n')));
}

/** A name: trimmed, and with any run of spaces (or a pasted non-breaking space) made a single space. */
export function requiredText(label: string, missing: string, max: number) {
  return z
    .string({ error: missing })
    .trim()
    .min(1, missing)
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => value.replace(/\s+/g, ' '));
}

/** A checkbox: browsers leave an unticked one out of the form data entirely. */
export const checkbox = z
  .string()
  .optional()
  .transform((value) => value === 'on');

export function optionalUrl() {
  return z
    .string()
    .trim()
    .default('')
    .transform((value, ctx) => {
      if (value === '') return null;
      const url = normalizeUrl(value);
      if (!url) {
        ctx.issues.push({
          code: 'custom',
          message: 'Enter a web address, like https://example.edu.',
          input: value,
        });
        return z.NEVER;
      }
      return url;
    });
}

// Grad-school dates live in this window; it also catches a typed "0026" instead of "2026".
const EARLIEST_YEAR = '2000';
const LATEST_YEAR = '2100';

export function optionalDate(invalid = 'Enter a valid date.') {
  return z
    .string()
    .trim()
    .default('')
    .transform((value, ctx) => {
      if (value === '') return null;
      const message = Number.isNaN(daysBetween(value, value))
        ? invalid
        : value.slice(0, 4) < EARLIEST_YEAR || value.slice(0, 4) > LATEST_YEAR
          ? `Enter a date between ${EARLIEST_YEAR} and ${LATEST_YEAR}.`
          : null;
      if (message) {
        ctx.issues.push({ code: 'custom', message, input: value });
        return z.NEVER;
      }
      return value;
    });
}

const optionalDateTime = z
  .string()
  .trim()
  .default('')
  .transform((value, ctx) => {
    if (value === '') return null;
    const timestamp = fromDateTimeLocal(value);
    const year = value.slice(0, 4);
    if (!timestamp || year < EARLIEST_YEAR || year > LATEST_YEAR) {
      ctx.issues.push({ code: 'custom', message: 'Enter a valid date and time.', input: value });
      return z.NEVER;
    }
    return timestamp;
  });

export const optionalAmount = z
  .string()
  .trim()
  .default('')
  .transform((value, ctx) => {
    const result = parseAmount(value);
    if (!result.ok) {
      ctx.issues.push({
        code: 'custom',
        message: 'Enter an amount between 0 and 1,000,000, like 90 or 90.50.',
        input: value,
      });
      return z.NEVER;
    }
    return result.value;
  });

const programLength = z
  .string()
  .trim()
  .default('')
  .transform((value, ctx) => {
    if (value === '') return null;
    const months = Number(value);
    if (!/^\d+$/.test(value) || months < 1 || months > 120) {
      ctx.issues.push({
        code: 'custom',
        message: 'Enter a whole number of months, from 1 to 120.',
        input: value,
      });
      return z.NEVER;
    }
    return months;
  });

const fieldsSchema = z.object({
  // University (shared by every program at the same school)
  university_name: requiredText('University name', 'Enter the university name.', 200),
  university_city: optionalText('City', 100),
  university_region: optionalText('State or region', 100),
  university_country: optionalText('Country', 100),
  university_website_url: optionalUrl(),

  // Program
  school_college: optionalText('School or college', 200),
  department: optionalText('Department', 200),
  program_name: requiredText('Program name', 'Enter the program name.', 200),
  degree_level: z.enum(DEGREE_LEVEL_VALUES, { error: 'Choose a degree level.' }),
  degree_type: optionalText('Degree', 50),
  program_url: optionalUrl(),
  program_length_months: programLength,
  is_stem: checkbox,

  // Application
  status: z.enum(STATUS_VALUES, { error: 'Choose a status.' }),
  priority: z
    .enum(['', ...PRIORITY_VALUES], { error: 'Choose a priority.' })
    .default('')
    .transform((value) => (value === '' ? null : value)),
  deadline: optionalDate('Enter a valid deadline.'),
  priority_deadline: optionalDate(),
  portal_url: optionalUrl(),

  // Fee
  application_fee: optionalAmount,
  fee_currency: z
    .string()
    .trim()
    .default('USD')
    .pipe(z.string().regex(/^[A-Z]{3}$/, 'Choose a currency.')),
  fee_waiver_available: checkbox,
  fee_waiver_status: z
    .enum(FEE_WAIVER_VALUES, { error: 'Choose a waiver status.' })
    .default('not_requested'),
  fee_paid_on: optionalDate(),

  // Progress and decision
  submitted_on: optionalDate(),
  interview_at: optionalDateTime,
  decision_received_on: optionalDate(),
  decision_deadline: optionalDate(),
  enrollment_deposit: optionalAmount,
  is_final_choice: checkbox,

  notes: optionalText('Notes', 10_000),
});

type Fields = z.output<typeof fieldsSchema>;

function toInput(values: Fields): ApplicationInput {
  return {
    university: {
      name: values.university_name,
      city: values.university_city,
      region: values.university_region,
      country: values.university_country,
      website_url: values.university_website_url,
    },
    application: {
      school_college: values.school_college,
      department: values.department,
      program_name: values.program_name,
      degree_level: values.degree_level,
      degree_type: values.degree_type,
      program_url: values.program_url,
      program_length_months: values.program_length_months,
      is_stem: values.is_stem,
      status: values.status,
      priority: values.priority,
      deadline: values.deadline,
      priority_deadline: values.priority_deadline,
      portal_url: values.portal_url,
      interview_at: values.interview_at,
      submitted_on: values.submitted_on,
      application_fee: values.application_fee,
      fee_currency: values.fee_currency,
      fee_waiver_available: values.fee_waiver_available,
      // A waiver that isn't on offer can't have been requested or granted.
      fee_waiver_status: values.fee_waiver_available ? values.fee_waiver_status : 'not_requested',
      fee_paid_on: values.fee_paid_on,
      decision_received_on: values.decision_received_on,
      decision_deadline: values.decision_deadline,
      enrollment_deposit: values.enrollment_deposit,
      is_final_choice: values.is_final_choice,
      notes: values.notes,
    },
  };
}

const DATES_TO_COMPARE = ['deadline', 'priority_deadline'];

export const applicationFormSchema = fieldsSchema
  .refine(
    (values) =>
      !(values.deadline && values.priority_deadline && values.priority_deadline > values.deadline),
    {
      path: ['priority_deadline'],
      message: 'The priority deadline must be on or before the final deadline.',
      // Checked even when some other field has a mistake, so all the problems show at once. It
      // waits only for the two dates themselves to be readable.
      when: ({ issues }) =>
        !issues.some((issue) => DATES_TO_COMPARE.includes(String(issue.path?.[0]))),
    },
  )
  .transform(toInput);

/** What each form control starts with. Text fields are strings; checkboxes are booleans. */
export type ApplicationFormValues = {
  university_name: string;
  university_city: string;
  university_region: string;
  university_country: string;
  university_website_url: string;
  school_college: string;
  department: string;
  program_name: string;
  degree_level: string;
  degree_type: string;
  program_url: string;
  program_length_months: string;
  is_stem: boolean;
  status: string;
  priority: string;
  deadline: string;
  priority_deadline: string;
  portal_url: string;
  application_fee: string;
  fee_currency: string;
  fee_waiver_available: boolean;
  fee_waiver_status: string;
  fee_paid_on: string;
  submitted_on: string;
  interview_at: string;
  decision_received_on: string;
  decision_deadline: string;
  enrollment_deposit: string;
  is_final_choice: boolean;
  notes: string;
};

export function emptyFormValues(): ApplicationFormValues {
  return {
    university_name: '',
    university_city: '',
    university_region: '',
    university_country: '',
    university_website_url: '',
    school_college: '',
    department: '',
    program_name: '',
    degree_level: 'masters',
    degree_type: '',
    program_url: '',
    program_length_months: '',
    is_stem: false,
    status: 'researching',
    priority: '',
    deadline: '',
    priority_deadline: '',
    portal_url: '',
    application_fee: '',
    fee_currency: 'USD',
    fee_waiver_available: false,
    fee_waiver_status: 'not_requested',
    fee_paid_on: '',
    submitted_on: '',
    interview_at: '',
    decision_received_on: '',
    decision_deadline: '',
    enrollment_deposit: '',
    is_final_choice: false,
    notes: '',
  };
}

const text = (value: string | number | null) => (value === null ? '' : String(value));

export function formValuesFromRecord(record: ApplicationRecord): ApplicationFormValues {
  return {
    university_name: record.university.name,
    university_city: text(record.university.city),
    university_region: text(record.university.region),
    university_country: text(record.university.country),
    university_website_url: text(record.university.website_url),
    school_college: text(record.school_college),
    department: text(record.department),
    program_name: record.program_name,
    degree_level: record.degree_level,
    degree_type: text(record.degree_type),
    program_url: text(record.program_url),
    program_length_months: text(record.program_length_months),
    is_stem: record.is_stem,
    status: record.status,
    priority: text(record.priority),
    deadline: text(record.deadline),
    priority_deadline: text(record.priority_deadline),
    portal_url: text(record.portal_url),
    application_fee: text(record.application_fee),
    fee_currency: record.fee_currency,
    fee_waiver_available: record.fee_waiver_available,
    fee_waiver_status: record.fee_waiver_status,
    fee_paid_on: text(record.fee_paid_on),
    submitted_on: text(record.submitted_on),
    interview_at: record.interview_at ? toDateTimeLocal(record.interview_at) : '',
    decision_received_on: text(record.decision_received_on),
    decision_deadline: text(record.decision_deadline),
    enrollment_deposit: text(record.enrollment_deposit),
    is_final_choice: record.is_final_choice,
    notes: text(record.notes),
  };
}
