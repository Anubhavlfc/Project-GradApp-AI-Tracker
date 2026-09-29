import { Link } from 'react-router';
import { Check } from 'lucide-react';
import { brand } from '@/config/brand';
import { cn } from '@/lib/cn';

export function Brand({ showName = true, className }: { showName?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      aria-label={showName ? undefined : brand.name}
      className={cn(
        'focus-ring flex items-center gap-2.5 rounded-md font-semibold tracking-tight',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-fg"
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
      {showName ? <span className="truncate">{brand.shortName}</span> : null}
    </Link>
  );
}
