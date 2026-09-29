import { brand } from '@/config/brand';
import { CallToAction } from './CallToAction';
import { Container } from './Container';
import { ProductPreview } from './ProductPreview';

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="hero-heading" className="pb-16 pt-12 sm:pb-24 sm:pt-20">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h1
            id="hero-heading"
            className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
          >
            {brand.tagline}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-fg-muted sm:text-xl">
            {brand.description}
          </p>
          <CallToAction signedIn={signedIn} signUpLabel="Create an account" className="mt-8" />
          <p className="mt-4 text-balance text-sm text-fg-subtle">
            Each account's applications are private to that account.
          </p>
        </div>
      </Container>
      <ProductPreview />
    </section>
  );
}
