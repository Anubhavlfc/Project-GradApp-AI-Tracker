import { ButtonLink } from '@/components/ui';
import { brand } from '@/config/brand';

// Placeholder until the public landing page is designed (Phase 11).
export function LandingPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{brand.tagline}</h1>
      <p className="mt-4 text-base text-fg-muted">{brand.description}</p>
      <ButtonLink to="/app" variant="primary" className="mt-8">
        Open the app
      </ButtonLink>
    </main>
  );
}
