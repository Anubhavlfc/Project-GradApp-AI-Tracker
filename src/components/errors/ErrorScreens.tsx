import { TriangleAlert } from 'lucide-react';
import { Button, ButtonLink, buttonStyles, EmptyState } from '@/components/ui';
import { isLoadFailure } from './loadFailure';

type ScreenProps = { error: unknown; reset: () => void };

function reload() {
  window.location.reload();
}

/**
 * Shown in place of one page when it fails to draw. The menu around it still works, so there are
 * two ways out: try the page again, or go somewhere else.
 */
export function PageErrorScreen({ error, reset }: ScreenProps) {
  const cannotLoad = isLoadFailure(error);
  return (
    <div role="alert" className="mx-auto max-w-2xl py-10">
      <EmptyState
        as="h1"
        icon={TriangleAlert}
        title={cannotLoad ? "This page couldn't be loaded" : 'Something went wrong on this page'}
        description={
          cannotLoad
            ? 'Check your connection and reload. If the app was just updated, reloading fetches the newest version.'
            : 'Anything you had already saved is safe. Try again, or open another page from the menu.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {cannotLoad ? (
              <Button variant="primary" onClick={reload}>
                Reload page
              </Button>
            ) : (
              <Button variant="primary" onClick={reset}>
                Try again
              </Button>
            )}
            <ButtonLink to="/app">Go to dashboard</ButtonLink>
          </div>
        }
      />
    </div>
  );
}

/**
 * The last resort, for a failure in the frame around everything. It uses no context and no router
 * link, because either of those may be what broke; a reload starts the app afresh.
 */
export function AppErrorScreen({ error }: Pick<ScreenProps, 'error'>) {
  const cannotLoad = isLoadFailure(error);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <div role="alert" className="w-full">
        <EmptyState
          as="h1"
          icon={TriangleAlert}
          title={cannotLoad ? "The app couldn't be loaded" : 'Something went wrong'}
          description={
            cannotLoad
              ? 'Check your connection and reload. If the app was just updated, reloading fetches the newest version.'
              : 'Reload the page to start again. Anything you had already saved is safe.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={reload}>
                Reload page
              </Button>
              <a href="/" className={buttonStyles({ variant: 'secondary' })}>
                Go to the home page
              </a>
            </div>
          }
        />
      </div>
    </main>
  );
}
