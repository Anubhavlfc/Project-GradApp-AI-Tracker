import { z } from 'zod';
import {
  checkbox,
  currencyCode,
  optionalAmount,
  optionalDate,
  optionalText,
  optionalUrl,
  requiredText,
} from '@/features/applications/form';
import { FUNDING_KIND_VALUES, FUNDING_STATUS_VALUES } from './kinds';
import type { FundingFields, FundingRow } from './types';

// The add/edit form for one funding item. The browser gives us every field as a string, so this
// file has the two jobs: turn those strings into typed FundingFields (or a message per field),
// and turn a saved item back into strings for the form to show.

export const fundingFormSchema = z.object({
  // Empty means "not tied to a program", like an outside scholarship you would take anywhere.
  application_id: z
    .string()
    .trim()
    .default('')
    .transform((value) => (value === '' ? null : value)),
  name: requiredText('Name', 'Enter a name, like "Departmental fellowship".', 200),
  kind: z.enum(FUNDING_KIND_VALUES, { error: 'Choose a type.' }),
  amount: optionalAmount,
  currency: currencyCode,
  deadline: optionalDate('Enter a valid deadline.'),
  application_required: checkbox,
  status: z.enum(FUNDING_STATUS_VALUES, { error: 'Choose a status.' }),
  url: optionalUrl(),
  notes: optionalText('Notes', 10_000),
}) satisfies z.ZodType<FundingFields, unknown>;

/** What each form control starts with. Text fields are strings; the checkbox is a boolean. */
export type FundingFormValues = {
  application_id: string;
  name: string;
  kind: string;
  amount: string;
  currency: string;
  deadline: string;
  application_required: boolean;
  status: string;
  url: string;
  notes: string;
};

/** A new item, for `applicationId` when opened from a program's page. */
export function emptyFundingValues(applicationId = '', currency = 'USD'): FundingFormValues {
  return {
    application_id: applicationId,
    name: '',
    kind: 'university_scholarship',
    amount: '',
    currency,
    deadline: '',
    application_required: false,
    status: 'researching',
    url: '',
    notes: '',
  };
}

const text = (value: string | number | null) => (value === null ? '' : String(value));

export function fundingValuesFromRow(row: FundingRow): FundingFormValues {
  return {
    application_id: text(row.application_id),
    name: row.name,
    kind: row.kind,
    amount: text(row.amount),
    currency: row.currency,
    deadline: text(row.deadline),
    application_required: row.application_required,
    status: row.status,
    url: text(row.url),
    notes: text(row.notes),
  };
}
