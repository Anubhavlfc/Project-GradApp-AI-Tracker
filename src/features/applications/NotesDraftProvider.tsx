import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NotesDraftContext, type NotesDrafts } from './notesDraftContext';

/** Holds the unsaved notes of each program, above the pages of the signed-in app. */
export function NotesDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(() => new Map());

  const keep = useCallback((applicationId: string, text: string | null) => {
    setDrafts((current) => {
      if (text === null) {
        if (!current.has(applicationId)) return current;
        const next = new Map(current);
        next.delete(applicationId);
        return next;
      }
      // The same text again changes nothing, so nothing has to be drawn again.
      if (current.get(applicationId) === text) return current;
      return new Map(current).set(applicationId, text);
    });
  }, []);

  const value = useMemo<NotesDrafts>(
    () => ({ draftFor: (applicationId) => drafts.get(applicationId) ?? null, keep }),
    [drafts, keep],
  );

  // Closing or reloading the page would lose what has not been saved: let the browser ask first.
  const unsaved = drafts.size > 0;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  return <NotesDraftContext value={value}>{children}</NotesDraftContext>;
}
