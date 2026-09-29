import { Alert, Button, Modal } from '@/components/ui';
import { toDataError } from '@/lib/dataError';
import { useDeleteApplication } from './hooks';
import { applicationName } from './labels';
import type { ApplicationRecord } from './types';

type DeleteApplicationDialogProps = {
  /** The program to delete; the dialog is open while this is set. */
  record: ApplicationRecord | null;
  onClose: () => void;
  onDeleted: (record: ApplicationRecord) => void;
};

/** Asks before deleting, because there is no undo. Stays open with a message if it fails. */
export function DeleteApplicationDialog({
  record,
  onClose,
  onDeleted,
}: DeleteApplicationDialogProps) {
  const remove = useDeleteApplication();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!record) return;
    try {
      await remove.mutateAsync(record.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(record);
  }

  return (
    <Modal
      open={record !== null}
      onClose={close}
      size="sm"
      title="Delete this application?"
      description={
        record
          ? `${applicationName(record)} and its notes will be removed permanently. This can't be undone.`
          : undefined
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Delete application
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't delete this application">
          {toDataError(remove.error).message}
        </Alert>
      ) : (
        <p className="text-fg-muted">Tracked requirements, recommenders and tasks go with it.</p>
      )}
    </Modal>
  );
}
