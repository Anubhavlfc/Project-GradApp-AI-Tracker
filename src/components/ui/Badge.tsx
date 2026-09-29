import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { toneBadge, toneDot, type Tone } from './tone';

type BadgeProps = {
  tone?: Tone;
  dot?: boolean;
  /** Let a long label wrap onto a second line instead of running past its container. */
  wrap?: boolean;
  className?: string;
  children: ReactNode;
};

export function Badge({
  tone = 'neutral',
  dot = false,
  wrap = false,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        wrap ? 'whitespace-normal text-left' : 'whitespace-nowrap',
        toneBadge[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} />
      ) : null}
      {children}
    </span>
  );
}
