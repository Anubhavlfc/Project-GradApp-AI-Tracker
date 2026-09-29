import type { ReactNode } from 'react';
import { Link } from 'react-router';

type CompactRowProps = {
  title: string;
  /** Where the whole row goes; null for a row that is only information. */
  href: string | null;
  /** A line under the title: the program, or what kind of thing it is. */
  context?: string | null;
  /** Shown on the right: a date, a count, a badge. */
  trailing?: ReactNode;
  /** Something before the title, such as an icon. */
  leading?: ReactNode;
};

/**
 * A row in a dashboard list: a title, a line under it, and something on the right. When it has
 * somewhere to go the whole row is the link, and the title is the one thing a keyboard reaches.
 */
export function CompactRow({ title, href, context, trailing, leading }: CompactRowProps) {
  return (
    <li className="relative flex items-start gap-3 px-4 py-3 hover:bg-surface-muted">
      {leading}
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-6">
          {href ? (
            <Link
              to={href}
              className="focus-ring rounded-sm after:absolute after:inset-0 hover:underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </p>
        {context ? <p className="mt-0.5 break-words text-xs text-fg-muted">{context}</p> : null}
      </div>
      {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
    </li>
  );
}
