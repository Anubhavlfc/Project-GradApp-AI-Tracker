import { useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Modal } from '@/components/ui';
import { settingsErrorMessage, useDeleteAccount } from './hooks';

/** What must be typed to confirm: the email address, or a plain word if there is none. */
const FALLBACK_PHRASE = 'delete';

type DeleteAccountDialogProps = { open: boolean; email: string | null; onClose: () => void };

/** Asks the person to type their email address before deleting everything, because there is no undo. */
export function DeleteAccountDialog({ open, email, onClose }: DeleteAccountDialogProps) {
  const remove = useDeleteAccount();
  const [typed, setTyped] = useState('');
  const phrase = email ?? FALLBACK_PHRASE;
  const matches = typed.trim().toLowerCase() === phrase.toLowerCase();

  function close() {
    remove.reset();
    setTyped('');
    onClose();
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!matches || remove.isPending) return;
    try {
      await remove.mutateAsync();
    } catch {
      return; // the message is shown in the dialog
    }
    // Deleted: the app now shows the sign-in page, so there is nothing more to do here.
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="Delete your account?"
      description={
        email
          ? `This permanently deletes ${email} and everything in it. It can't be undone.`
          : "This permanently deletes your account and everything in it. It can't be undone."
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            type="submit"
            form="delete-account-form"
            variant="danger"
            disabled={!matches}
            loading={remove.isPending}
          >
            {remove.isPending ? 'Deleting…' : 'Delete account and data'}
          </Button>
        </>
      }
    >
      <form
        id="delete-account-form"
        onSubmit={(event) => void confirm(event)}
        className="space-y-4"
      >
        {remove.error ? (
          <Alert kind="danger" title="Couldn't delete your account">
            {settingsErrorMessage(remove.error)} Nothing was deleted.
          </Alert>
        ) : null}
        <Field label={email ? 'Type your email address to confirm' : `Type "${phrase}" to confirm`}>
          {(control) => (
            <Input
              {...control}
              data-autofocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
