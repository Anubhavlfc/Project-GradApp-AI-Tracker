import { Alert, Button, Modal } from '@/components/ui';
import { fundingErrorMessage, useDeleteFunding } from './hooks';
import type { FundingRow } from './types';

type DeleteFundingDialogProps = {
  /** The item to delete; the dialog is open while this is set. */
  item: FundingRow | null;
  onClose: () => void;
  onDeleted: (item: FundingRow) => void;
};

/** Asks before deleting a funding item, because there is no undo. */
export function DeleteFundingDialog({ item, onClose, onDeleted }: DeleteFundingDialogProps) {
  const remove = useDeleteFunding();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!item) return;
    try {
      await remove.mutateAsync(item.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(item);
  }

  return (
    <Modal
      open={item !== null}
      onClose={close}
      size="sm"
      title="Delete this funding item?"
      description={
        item ? `“${item.name}” will be removed from your funding. This can't be undone.` : undefined
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Delete funding
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't delete this funding item">
          {fundingErrorMessage(remove.error)}
        </Alert>
      ) : null}
    </Modal>
  );
}
