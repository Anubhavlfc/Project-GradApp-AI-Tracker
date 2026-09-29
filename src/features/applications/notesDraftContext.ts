import { createContext, useContext } from 'react';

// The text typed into a program's notes box and not saved yet. The box lives on one tab of the
// program's page, so going to another tab (or page) would throw the text away; it is kept above
// them instead (see NotesDraftProvider), for as long as the signed-in app stays open. Closing or
// reloading the browser page with something unsaved asks first.

export type NotesDrafts = {
  /** The unsaved text for this program, or null when there is none. */
  draftFor(applicationId: string): string | null;
  /** Keeps the unsaved text for this program, or forgets it when given null. */
  keep(applicationId: string, text: string | null): void;
};

// Outside a program's page nothing is kept, and nothing breaks.
const nothing: NotesDrafts = { draftFor: () => null, keep: () => {} };

export const NotesDraftContext = createContext<NotesDrafts>(nothing);

export function useNotesDrafts(): NotesDrafts {
  return useContext(NotesDraftContext);
}
