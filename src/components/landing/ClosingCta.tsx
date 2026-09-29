import { CallToAction } from './CallToAction';
import { Container } from './Container';

export function ClosingCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="closing-heading" className="border-y border-border bg-surface">
      <Container className="py-16 text-center sm:py-20">
        <h2
          id="closing-heading"
          className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Start with your first program.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-balance text-base text-fg-muted sm:text-lg">
          Create an account, add a program, and see where every application stands.
        </p>
        <CallToAction signedIn={signedIn} signUpLabel="Get started" className="mt-8" />
      </Container>
    </section>
  );
}
