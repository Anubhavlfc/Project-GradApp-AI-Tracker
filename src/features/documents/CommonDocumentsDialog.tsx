import { useState } from 'react';
import { Alert, Button, Checkbox, Modal } from '@/components/ui';
import { documentErrorMessage, useAddDocuments } from './hooks';
import { COMMON_DOCUMENTS } from './kinds';
import type { DocumentRow } from './types';

type CommonDocumentsDialogProps = {
  open: boolean;
  /** The documents as they are now: a type already on the list is shown but not offered again. */
  documents: readonly DocumentRow[];
  onClose: () => void;
  /** Called after the documents were added, with a sentence for the page to announce. */
  onAdded: (message: string) => void;
};

function addLabel(count: number): string {
  if (count === 0) return 'Add documents';
  return count === 1 ? 'Add 1 document' : `Add ${count} documents`;
}

/** Pick the usual documents in one go instead of adding them one at a time. */
export function CommonDocumentsDialog({
  open,
  documents,
  onClose,
  onAdded,
}: CommonDocumentsDialogProps) {
  const add = useAddDocuments();
  // Until you tick or untick something, the usual choices are ticked.
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const has = (kind: string) => documents.some((document) => document.kind === kind);
  const selected =
    picked ?? new Set(COMMON_DOCUMENTS.filter((item) => item.preselected).map((item) => item.id));
  // A type already on the list is never added again, however it got ticked.
  const chosen = COMMON_DOCUMENTS.filter((item) => selected.has(item.id) && !has(item.kind));

  function close() {
    setPicked(null);
    setError(null);
    add.reset();
    onClose();
  }

  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setPicked(next);
  }

  async function submit() {
    setError(null);
    try {
      const created = await add.mutateAsync(
        chosen.map((item) => ({
          name: item.name,
          kind: item.kind,
          status: 'not_started' as const,
          url: null,
          notes: null,
        })),
      );
      setPicked(null);
      onAdded(`Added ${created.length} ${created.length === 1 ? 'document' : 'documents'}.`);
      onClose();
    } catch (failure) {
      setError(documentErrorMessage(failure));
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add the usual documents"
      description="Tick what you will need. You can rename them, add links, or remove any of them later."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            loading={add.isPending}
            disabled={chosen.length === 0}
            onClick={() => void submit()}
          >
            {addLabel(chosen.length)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Alert kind="danger" title="Failed to add documents">
            {error}
          </Alert>
        ) : null}
        <fieldset className="space-y-3">
          <legend className="sr-only">Documents to add</legend>
          {COMMON_DOCUMENTS.map((item) => {
            const present = has(item.kind);
            return (
              <Checkbox
                key={item.id}
                label={item.name}
                description={present ? 'Already on your list' : undefined}
                checked={!present && selected.has(item.id)}
                disabled={present}
                onChange={(event) => toggle(item.id, event.target.checked)}
              />
            );
          })}
        </fieldset>
      </div>
    </Modal>
  );
}
