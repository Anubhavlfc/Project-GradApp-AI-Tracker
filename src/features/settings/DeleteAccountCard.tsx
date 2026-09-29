import { useState } from 'react';
import { Button, Card, CardBody, CardHeader } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { DeleteAccountDialog } from './DeleteAccountDialog';

/** The way to remove the account and everything in it, kept apart and asked about twice. */
export function DeleteAccountCard() {
  const { state } = useAuth();
  const [open, setOpen] = useState(false);
  if (state.status !== 'signed_in') return null;

  return (
    <Card className="border-tone-red/30">
      <CardHeader title="Delete account" description="Remove your account and everything in it." />
      <CardBody className="space-y-4">
        <p className="text-fg-muted">
          This deletes your programs, checklists, recommenders, funding, documents, tasks and notes,
          and closes your account. It can&apos;t be undone. Download your data first if you want a
          copy.
        </p>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete account…
        </Button>
      </CardBody>
      <DeleteAccountDialog
        open={open}
        email={state.user.email ?? null}
        onClose={() => setOpen(false)}
      />
    </Card>
  );
}
