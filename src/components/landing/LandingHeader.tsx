import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { brand } from '@/config/brand';
import { Container } from './Container';

export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border">
      <Container className="flex h-14 items-center justify-between gap-3 sm:h-16">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-semibold leading-tight tracking-tight sm:text-base">
          <span
            aria-hidden="true"
            className="hidden size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-fg sm:grid"
          >
            <Check className="size-4" strokeWidth={3} />
          </span>
          {/* The full name does not fit beside two buttons on a phone, so the short one stands in. */}
          <span className="text-balance sm:hidden">{brand.shortName}</span>
          <span className="hidden sm:inline">{brand.name}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {signedIn ? (
            <ButtonLink to="/app" variant="primary" size="sm">
              Open the app
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink to="/signup" variant="primary" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
      </Container>
    </header>
  );
}
