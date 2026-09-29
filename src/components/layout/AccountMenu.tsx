import { useState } from 'react';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import { Button, IconButton, Menu, MenuItem, MenuLabel, Modal } from '@/components/ui';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/lib/cn';

function Avatar({ email }: { email: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent-soft-fg"
    >
      {email.charAt(0) || '?'}
    </span>
  );
}

type AccountMenuProps = {
  /** Show the email next to the avatar (used in the wide sidebar). */
  showEmail?: boolean;
  align?: 'start' | 'end';
};

/** Who is signed in, and the way to sign out. Renders nothing when nobody is signed in. */
export function AccountMenu({ showEmail = false, align }: AccountMenuProps) {
  const { state, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (state.status !== 'signed_in') return null;
  const email = state.user.email ?? 'Signed in';

  async function handleSignOut() {
    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);
    // On success the auth listener flips the app to signed out and the route guard leaves /app.
    if (!result.ok) setSignOutError(result.message);
  }

  return (
    <>
      <Menu
        label="Account"
        align={align}
        trigger={(props) =>
          showEmail ? (
            <button
              {...props}
              type="button"
              className={cn(
                'focus-ring flex w-full items-center gap-2.5 rounded-md p-1.5 text-left text-sm hover:bg-surface-muted',
                signingOut && 'opacity-60',
              )}
            >
              <Avatar email={email} />
              <span className="min-w-0 flex-1 truncate">{email}</span>
              <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
            </button>
          ) : (
            <IconButton label={`Account: ${email}`} {...props}>
              <Avatar email={email} />
            </IconButton>
          )
        }
      >
        <MenuLabel>{email}</MenuLabel>
        <MenuItem icon={<LogOut aria-hidden="true" className="size-4" />} onSelect={handleSignOut}>
          Sign out
        </MenuItem>
      </Menu>

      <Modal
        open={signOutError !== null}
        onClose={() => setSignOutError(null)}
        title="Couldn't sign out"
        description={signOutError ?? undefined}
        size="sm"
        footer={
          <>
            <Button onClick={() => setSignOutError(null)}>Close</Button>
            <Button
              variant="primary"
              onClick={() => {
                setSignOutError(null);
                void handleSignOut();
              }}
            >
              Try again
            </Button>
          </>
        }
      >
        <p className="text-fg-muted">You are still signed in on this device.</p>
      </Modal>
    </>
  );
}
