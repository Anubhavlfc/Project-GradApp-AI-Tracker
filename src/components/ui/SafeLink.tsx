import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { isHttpUrl } from '@/lib/url';

type SafeLinkProps = { href: string; children: ReactNode; className?: string };

/**
 * A link to a website someone typed in. Only http(s) addresses become links (never
 * javascript: or data:), and they open in a new tab that can't reach back into this one.
 */
export function SafeLink({ href, children, className }: SafeLinkProps) {
  if (!isHttpUrl(href)) return <span className={className}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'focus-ring inline-flex max-w-full items-center gap-1 rounded-sm text-accent-soft-fg underline underline-offset-2',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
