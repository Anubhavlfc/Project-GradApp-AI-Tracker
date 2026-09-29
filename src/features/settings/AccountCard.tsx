import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DescriptionItem,
  DescriptionList,
} from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';

/** Who is signed in, and the way to sign out. */
export function AccountCard() {
  const { state, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (state.status !== 'signed_in') return null;

  async function leave() {
    setError(null);
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    // On success the auth listener flips the app to signed out and the route guard leaves /app.
    if (!result.ok) setError(result.message);
  }

  return (
    <Card>
      <CardHeader title="Account" />
      <CardBody className="space-y-4">
        <DescriptionList>
          <DescriptionItem label="Email">{state.user.email ?? 'Not available'}</DescriptionItem>
        </DescriptionList>
        {error ? (
          <Alert kind="danger" title="Couldn't sign out">
            {error} You are still signed in on this device.
          </Alert>
        ) : null}
        <Button loading={signingOut} onClick={() => void leave()}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </CardBody>
    </Card>
  );
}
