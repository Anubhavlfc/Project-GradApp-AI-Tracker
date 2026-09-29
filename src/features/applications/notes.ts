import { optionalText } from './form';

/** The most a program's notes can hold, the same limit the database enforces. */
export const NOTES_MAX = 10_000;

const notesSchema = optionalText('Notes', NOTES_MAX);

export type ParsedNotes = { ok: true; notes: string | null } | { ok: false; message: string };

/**
 * What would be saved for the text in the notes box: blank space at both ends dropped, line
 * endings made plain, and nothing at all when it is empty. Or why it cannot be saved.
 */
export function parseNotes(text: string): ParsedNotes {
  const result = notesSchema.safeParse(text);
  return result.success
    ? { ok: true, notes: result.data }
    : { ok: false, message: result.error.issues[0]?.message ?? 'These notes cannot be saved.' };
}

/** True when saving `text` would change what is stored. Text that cannot be saved counts as changed. */
export function notesChanged(text: string, saved: string | null): boolean {
  const parsed = parseNotes(text);
  return !parsed.ok || parsed.notes !== saved;
}
