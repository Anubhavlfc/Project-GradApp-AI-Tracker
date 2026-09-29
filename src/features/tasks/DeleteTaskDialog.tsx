import { Alert, Button, Modal } from '@/components/ui';
import { taskErrorMessage, useDeleteTask } from './hooks';
import type { TaskRow } from './types';

type DeleteTaskDialogProps = {
  /** The task to delete; the dialog is open while this is set. */
  task: TaskRow | null;
  onClose: () => void;
  onDeleted: (task: TaskRow) => void;
};

/** Asks before deleting a task, because there is no undo. */
export function DeleteTaskDialog({ task, onClose, onDeleted }: DeleteTaskDialogProps) {
  const remove = useDeleteTask();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!task) return;
    try {
      await remove.mutateAsync(task.id);
    } catch {
      return; // the message is shown in the dialog
    }
    remove.reset();
    onDeleted(task);
  }

  return (
    <Modal
      open={task !== null}
      onClose={close}
      size="sm"
      title="Delete this task?"
      description={
        task ? `“${task.title}” will be removed from your tasks. This can't be undone.` : undefined
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" loading={remove.isPending} onClick={() => void confirm()}>
            Delete task
          </Button>
        </>
      }
    >
      {remove.error ? (
        <Alert kind="danger" title="Couldn't delete this task">
          {taskErrorMessage(remove.error)}
        </Alert>
      ) : null}
    </Modal>
  );
}
