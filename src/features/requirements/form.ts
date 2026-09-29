import { z } from 'zod';
import { checkbox, optionalDate, optionalText } from '@/features/applications/form';
import { REQUIREMENT_KIND_VALUES, REQUIREMENT_STATUS_VALUES } from './kinds';
import type { RequirementFields, RequirementRow } from './types';

// The add/edit form for one checklist item. The browser gives us every field as a string, so this
// file has the two jobs: turn those strings into typed RequirementFields (or a message per field),
// and turn a saved item back into strings for the form to show.

const fieldsSchema = z.object({
  kind: z.enum(REQUIREMENT_KIND_VALUES, { error: 'Choose a type.' }),
  // A name is optional except for "Other"; any run of spaces becomes a single space.
  label: optionalText('Name', 200).transform((value) =>
    value === null ? null : value.replace(/\s+/g, ' '),
  ),
  status: z.enum(REQUIREMENT_STATUS_VALUES, { error: 'Choose a status.' }),
  is_required: checkbox,
  due_date: optionalDate('Enter a valid due date.'),
  notes: optionalText('Notes', 10_000),
});

const NAME_FIELDS = ['kind', 'label'];

export const requirementFormSchema = fieldsSchema.refine(
  (values) => values.kind !== 'other' || values.label !== null,
  {
    path: ['label'],
    message: 'Give this requirement a name.',
    // Checked even when some other field has a mistake, so all the problems show at once. It
    // waits only for the type and the name themselves to be readable.
    when: ({ issues }) => !issues.some((issue) => NAME_FIELDS.includes(String(issue.path?.[0]))),
  },
) satisfies z.ZodType<RequirementFields, unknown>;

/** What each form control starts with. Text fields are strings; the checkbox is a boolean. */
export type RequirementFormValues = {
  kind: string;
  label: string;
  status: string;
  is_required: boolean;
  due_date: string;
  notes: string;
};

/** A new item: required and not started, which is what most items are. */
export function emptyRequirementValues(): RequirementFormValues {
  return {
    kind: 'resume_cv',
    label: '',
    status: 'not_started',
    is_required: true,
    due_date: '',
    notes: '',
  };
}

export function requirementValuesFromRow(row: RequirementRow): RequirementFormValues {
  return {
    kind: row.kind,
    label: row.label ?? '',
    status: row.status,
    is_required: row.is_required,
    due_date: row.due_date ?? '',
    notes: row.notes ?? '',
  };
}
