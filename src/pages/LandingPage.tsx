import { ButtonLink } from '@/components/ui';
import { brand } from '@/config/brand';
import { useAuth } from '@/features/auth/useAuth';

// Placeholder until the public landing page is designed (Phase 11).
export function LandingPage() {
  const { state } = useAuth();
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{brand.tagline}</h1>
      <p className="mt-4 text-base text-fg-muted">{brand.description}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {state.status === 'signed_in' ? (
          <ButtonLink to="/app" variant="primary">
            Open the app
          </ButtonLink>
        ) : (
          <>
            <ButtonLink to="/signup" variant="primary">
              Create an account
            </ButtonLink>
            <ButtonLink to="/login">Sign in</ButtonLink>
          </>
        )}
      </div>
    </main>
  );
}
