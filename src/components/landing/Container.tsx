import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';

/** The landing page's content width: wide enough for the preview, narrow enough to stay calm. */
export function Container({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div className={cn('mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8', className)} {...props} />
  );
}
