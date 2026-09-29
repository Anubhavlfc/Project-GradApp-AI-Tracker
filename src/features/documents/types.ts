import { z } from 'zod';
import { DOCUMENT_KIND_VALUES, DOCUMENT_STATUS_VALUES } from './kinds';

// The shape the database returns for one document. Every row is checked against this when it
// arrives, so a mismatch between the schema and the app fails loudly here instead of as
// "undefined" on screen. Column names stay snake_case, exactly as stored.
export const documentRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(DOCUMENT_KIND_VALUES),
  status: z.enum(DOCUMENT_STATUS_VALUES),
  /** Where the file lives (Google Drive, Dropbox…). The app never stores the file itself. */
  url: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DocumentRow = z.infer<typeof documentRowSchema>;

/** What the add/edit form submits: everything about a document that a person can change. */
export type DocumentFields = Pick<DocumentRow, 'name' | 'kind' | 'status' | 'url' | 'notes'>;
