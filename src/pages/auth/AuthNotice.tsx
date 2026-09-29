import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type AuthNoticeProps = { icon: LucideIcon; children: ReactNode; action: ReactNode };

/** Body of the small "what happens next" cards: an icon, a sentence, and one way forward. */
export function AuthNotice({ icon: Icon, children, action }: AuthNoticeProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-md bg-surface-muted p-2 text-fg-muted">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <p className="min-w-0 break-words text-fg-muted">{children}</p>
      </div>
      {action}
    </div>
  );
}
