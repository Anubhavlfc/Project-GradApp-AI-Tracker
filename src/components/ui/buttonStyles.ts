import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'icon';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-fg hover:bg-surface-muted',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger: 'bg-danger text-danger-fg hover:bg-danger-hover',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3',
  md: 'h-9 gap-2 px-4',
  icon: 'size-9 shrink-0',
};

export type StyleOptions = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

/** Class string shared by <Button> and <ButtonLink> so links can look like buttons. */
export function buttonStyles({ variant = 'secondary', size = 'md', className }: StyleOptions = {}) {
  return cn(
    'focus-ring inline-flex select-none items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className,
  );
}
