import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { tonePanel, toneText, type Tone } from './tone';

type AlertKind = 'info' | 'success' | 'warning' | 'danger';

const kinds: Record<AlertKind, { tone: Tone; icon: LucideIcon }> = {
  info: { tone: 'blue', icon: Info },
  success: { tone: 'green', icon: CircleCheck },
  warning: { tone: 'amber', icon: TriangleAlert },
  danger: { tone: 'red', icon: CircleAlert },
};

type AlertProps = { kind?: AlertKind; title: string; children?: ReactNode; action?: ReactNode };

/** Inline message, e.g. "Unable to load programs." with a Retry action. */
export function Alert({ kind = 'info', title, children, action }: AlertProps) {
  const { tone, icon: Icon } = kinds[kind];
  return (
    <div
      role={kind === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-lg border p-3', tonePanel[tone])}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', toneText[tone])} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {children ? <div className="mt-0.5 text-fg-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
