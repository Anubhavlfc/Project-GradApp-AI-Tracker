import { Alert, Button, Modal } from '@/components/ui';
import { documentErrorMessage, useDeleteDocument } from './hooks';
import type { DocumentRow } from './types';

type DeleteDocumentDialogProps = {
  /** The document to delete; the dialog is open while this is set. */
  document: DocumentRow | null;
  /** How many checklist items use it; null when that is not known. */
  usedBy: number | null;
  onClose: () => void;
  onDeleted: (document: DocumentRow) => void;
};

function describe(document: DocumentRow, usedBy: number | null): string {
  const base = `“${document.name}” will be removed from your documents.`;
  const tail = "This can't be undone.";
  if (usedBy === null) {
    return `${base} Checklist items that use it stay on their lists, without a document. ${tail}`;
  }
  if (usedBy === 0) return `${base} ${tail}`;
  const items = usedBy === 1 ? '1 checklist item uses it' : `${usedBy} checklist items use it`;
  return `${base} ${items[0]!.toUpperCase()}${items.slice(1)}; ${usedBy === 1 ? 'it stays' : 'they stay'} on ${usedBy === 1 ? 'its' : 'their'} list, without a document. ${tail}`;
}

/** Asks before deleting a document, because there is no undo. */
export function DeleteDocumentDialog({
  document,
  usedBy,
  onClose,
  onDeleted,
}: DeleteDocumentDialogProps) {
  const remove = useDeleteDocument();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!document) return;
    try {
      await remove.mutateAsync(document.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(document);
  }

  return (
    <Modal
      open={document !== null}
      onClose={close}
      size="sm"
      title="Delete this document?"
      description={document ? describe(document, usedBy) : undefined}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Delete document
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't delete this document">
          {documentErrorMessage(remove.error)}
        </Alert>
      ) : null}
    </Modal>
  );
}
