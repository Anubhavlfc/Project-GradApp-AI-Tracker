import { ButtonLink, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState
        as="h1"
        title="Page not found"
        description="That page doesn't exist or has moved."
        action={<ButtonLink to="/">Go home</ButtonLink>}
      />
    </main>
  );
}
