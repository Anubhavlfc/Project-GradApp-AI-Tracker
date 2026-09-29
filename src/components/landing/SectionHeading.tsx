import type { ReactNode } from 'react';

type SectionHeadingProps = { id: string; title: string; children?: ReactNode };

/** A section's <h2> with an optional one-line introduction. */
export function SectionHeading({ id, title, children }: SectionHeadingProps) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {children ? <p className="mt-3 text-base text-fg-muted sm:text-lg">{children}</p> : null}
    </div>
  );
}
