import { ClosingCta } from '@/components/landing/ClosingCta';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { useAuth } from '@/features/auth/useAuth';

/** The public page at `/`. Someone already signed in is offered the app instead of sign-up. */
export function LandingPage() {
  const { state } = useAuth();
  const signedIn = state.status === 'signed_in';
  return (
    <div className="flex min-h-dvh flex-col">
      <LandingHeader signedIn={signedIn} />
      <main className="flex-1">
        <Hero signedIn={signedIn} />
        <Features />
        <HowItWorks />
        <ClosingCta signedIn={signedIn} />
      </main>
      <LandingFooter signedIn={signedIn} />
    </div>
  );
}
