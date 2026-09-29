import { z } from 'zod';
import { optionalText, optionalUrl, requiredText } from '@/features/applications/form';
import { DOCUMENT_KIND_VALUES, DOCUMENT_STATUS_VALUES } from './kinds';
import type { DocumentFields, DocumentRow } from './types';

// The add/edit form for one document. The browser gives us every field as a string, so this file
// has the two jobs: turn those strings into typed DocumentFields (or a message per field), and
// turn a saved document back into strings for the form to show.

export const documentFormSchema = z.object({
  name: requiredText('Name', 'Enter a name, like "Resume, 2026".', 200),
  kind: z.enum(DOCUMENT_KIND_VALUES, { error: 'Choose a type.' }),
  status: z.enum(DOCUMENT_STATUS_VALUES, { error: 'Choose a status.' }),
  url: optionalUrl(),
  notes: optionalText('Notes', 10_000),
}) satisfies z.ZodType<DocumentFields, unknown>;

/** What each form control starts with. Every control holds a string. */
export type DocumentFormValues = {
  name: string;
  kind: string;
  status: string;
  url: string;
  notes: string;
};

export function emptyDocumentValues(): DocumentFormValues {
  return { name: '', kind: 'resume', status: 'not_started', url: '', notes: '' };
}

const text = (value: string | null) => value ?? '';

export function documentValuesFromRow(row: DocumentRow): DocumentFormValues {
  return {
    name: row.name,
    kind: row.kind,
    status: row.status,
    url: text(row.url),
    notes: text(row.notes),
  };
}
