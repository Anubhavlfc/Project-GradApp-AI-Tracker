import { Alert, Button, Modal } from '@/components/ui';
import { requirementErrorMessage, useDeleteRequirement } from './hooks';
import { requirementTitle } from './progress';
import type { RequirementRow } from './types';

type DeleteRequirementDialogProps = {
  /** The item to delete; the dialog is open while this is set. */
  row: RequirementRow | null;
  onClose: () => void;
  onDeleted: (row: RequirementRow) => void;
};

/** Asks before deleting, because there is no undo. Stays open with a message if it fails. */
export function DeleteRequirementDialog({ row, onClose, onDeleted }: DeleteRequirementDialogProps) {
  const remove = useDeleteRequirement();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!row) return;
    try {
      await remove.mutateAsync(row.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(row);
  }

  return (
    <Modal
      open={row !== null}
      onClose={close}
      size="sm"
      title="Delete this requirement?"
      description={
        row
          ? `“${requirementTitle(row)}” will be removed from this checklist. This can't be undone.`
          : undefined
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Delete requirement
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't delete this requirement">
          {requirementErrorMessage(remove.error)}
        </Alert>
      ) : (
        <p className="text-fg-muted">Its status, due date and notes go with it.</p>
      )}
    </Modal>
  );
}
