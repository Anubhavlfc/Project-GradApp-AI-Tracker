import { Alert, Button, Modal } from '@/components/ui';
import { requestErrorMessage, useDeleteRequest } from './hooks';
import type { RequestRow } from './types';

type DeleteRequestDialogProps = {
  /** The request to remove; the dialog is open while this is set. */
  request: RequestRow | null;
  /** "Prof. Smith" and "Stanford University, MS Computer Science", for the sentence. */
  who: string;
  program: string;
  onClose: () => void;
  onDeleted: (request: RequestRow) => void;
};

/** Asks before removing a request, because there is no undo. The recommender stays on the list. */
export function DeleteRequestDialog({
  request,
  who,
  program,
  onClose,
  onDeleted,
}: DeleteRequestDialogProps) {
  const remove = useDeleteRequest();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!request) return;
    try {
      await remove.mutateAsync(request.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(request);
  }

  return (
    <Modal
      open={request !== null}
      onClose={close}
      size="sm"
      title="Remove this letter request?"
      description={`The request to ${who} for ${program} will be removed. This can't be undone.`}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Remove request
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't remove this request">
          {requestErrorMessage(remove.error)}
        </Alert>
      ) : (
        <p className="text-fg-muted">{who} stays on your list of recommenders.</p>
      )}
    </Modal>
  );
}
