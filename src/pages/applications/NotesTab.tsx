import { useEffect, useId, useState, type FormEvent } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Textarea } from '@/components/ui';
import { useSaveNotes } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { NOTES_MAX, notesChanged, parseNotes } from '@/features/applications/notes';
import { useNotesDrafts } from '@/features/applications/notesDraftContext';
import type { ApplicationRecord } from '@/features/applications/types';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { toDataError } from '@/lib/dataError';

const countFormat = new Intl.NumberFormat('en-US');

/** A program's notes: private, free text, saved when you say so. */
export function NotesTab() {
  const record = useApplicationRecord();
  // One box per program: moving to another program starts over from what that program has saved.
  return <NotesEditor key={record.id} record={record} />;
}

function NotesEditor({ record }: { record: ApplicationRecord }) {
  const save = useSaveNotes();
  const hintId = useId();
  const { draftFor, keep } = useNotesDrafts();

  // What is typed in the box. Until something is typed the box shows what is stored, so a change
  // made elsewhere shows up; once you start typing your text is kept, and it survives a trip to
  // another tab of this program (or another page) because it is also held above the tabs.
  const [draft, setDraft] = useState<string | null>(() => draftFor(record.id));
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = draft ?? record.notes ?? '';
  const parsed = parseNotes(text);
  const dirty = draft !== null && notesChanged(draft, record.notes);

  // Unsaved text is what gets held; leaving the box alone, or saving it, lets go of it.
  const held = dirty ? draft : null;
  useEffect(() => {
    keep(record.id, held);
  }, [keep, record.id, held]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dirty || !parsed.ok || save.isPending) return;
    setError(null);
    try {
      await save.mutateAsync({ id: record.id, notes: parsed.notes });
      setDraft(null);
      setJustSaved(true);
    } catch (failure) {
      setError(toDataError(failure).message);
    }
  }

  const characters = text.length;
  const tooLong = characters > NOTES_MAX;

  return (
    <div className="space-y-4">
      {error ? (
        <Alert
          kind="danger"
          title="Couldn't save your notes"
          action={
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              Dismiss
            </Button>
          }
        >
          {error} What you typed is still in the box.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Notes"
          description="Private notes about this program: what you learned, who to contact, ideas for your essay."
        />
        <CardBody>
          <form onSubmit={(event) => void submit(event)} className="space-y-3" noValidate>
            <Textarea
              aria-label={`Notes for ${applicationName(record)}`}
              aria-describedby={hintId}
              aria-invalid={parsed.ok ? undefined : true}
              rows={14}
              value={text}
              // Typing while a save is on its way would be lost when it finishes.
              readOnly={save.isPending}
              onChange={(event) => {
                setDraft(event.target.value);
                setJustSaved(false);
              }}
            />
            <p
              id={hintId}
              className={tooLong ? 'text-xs font-medium text-tone-red-fg' : 'text-xs text-fg-muted'}
            >
              {parsed.ok
                ? `${countFormat.format(characters)} of ${countFormat.format(NOTES_MAX)} characters`
                : parsed.message}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                loading={save.isPending}
                disabled={!dirty || !parsed.ok}
              >
                Save notes
              </Button>
              {dirty ? (
                <Button
                  onClick={() => {
                    setDraft(null);
                    setError(null);
                  }}
                >
                  Discard changes
                </Button>
              ) : null}
              <p role="status" className="text-xs text-fg-muted">
                {dirty ? 'Unsaved changes' : justSaved ? 'Saved.' : null}
              </p>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
