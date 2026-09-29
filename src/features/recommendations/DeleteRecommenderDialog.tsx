import { Alert, Button, Modal } from '@/components/ui';
import { recommenderErrorMessage, useDeleteRecommender } from './hooks';
import type { RecommenderRow } from './types';

type DeleteRecommenderDialogProps = {
  /** The person to delete; the dialog is open while this is set. */
  recommender: RecommenderRow | null;
  /** How many letter requests go with them. */
  requestCount: number;
  onClose: () => void;
  onDeleted: (recommender: RecommenderRow) => void;
};

/** Asks before deleting, because there is no undo. Stays open with a message if it fails. */
export function DeleteRecommenderDialog({
  recommender,
  requestCount,
  onClose,
  onDeleted,
}: DeleteRecommenderDialogProps) {
  const remove = useDeleteRecommender();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!recommender) return;
    try {
      await remove.mutateAsync(recommender.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(recommender);
  }

  return (
    <Modal
      open={recommender !== null}
      onClose={close}
      size="sm"
      title="Delete this recommender?"
      description={
        recommender ? `“${recommender.name}” will be removed from your recommenders.` : undefined
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Delete recommender
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't delete this recommender">
          {recommenderErrorMessage(remove.error)}
        </Alert>
      ) : (
        <p className="text-fg-muted">
          {requestCount > 0
            ? `Their ${requestCount} letter ${requestCount === 1 ? 'request' : 'requests'} will be removed too. This can't be undone.`
            : "This can't be undone."}
        </p>
      )}
    </Modal>
  );
}
