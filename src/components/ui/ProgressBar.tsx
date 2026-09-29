import { cn } from '@/lib/cn';

type ProgressBarProps = {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Stanford MSCS requirements completed". */
  label: string;
  className?: string;
};

export function ProgressBar({ value, max = 100, label, className }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fg/10', className)}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
