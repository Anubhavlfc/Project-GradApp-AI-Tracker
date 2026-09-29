import {
  ClipboardCheck,
  Coins,
  Flag,
  GraduationCap,
  ListChecks,
  Mail,
  Reply,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';
import { toneText } from '@/components/ui/tone';
import { formatDate } from '@/features/applications/dates';
import { cn } from '@/lib/cn';
import type { DeadlineItem, DeadlineSource } from './logic';

const icons: Record<DeadlineSource, LucideIcon> = {
  application: GraduationCap,
  priority: Flag,
  interview: Video,
  decision: Reply,
  requirement: ClipboardCheck,
  letter: Mail,
  funding: Coins,
  task: ListChecks,
};

/**
 * One date: what it is, which program it is for, when, and how far away that is. The whole row
 * links to the place where it can be dealt with.
 */
export function DeadlineRow({ item }: { item: DeadlineItem }) {
  const Icon = icons[item.source];
  const context = [item.detail, item.program].filter(Boolean).join(' · ');
  const { info } = item;

  return (
    <li className="relative flex items-start gap-3 px-4 py-3 hover:bg-surface-muted">
      <span className="mt-0.5 shrink-0 rounded-md bg-surface-muted p-1.5 text-fg-muted">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words font-medium leading-6">
          <Link
            to={item.href}
            className="focus-ring rounded-sm after:absolute after:inset-0 hover:underline"
          >
            {item.title}
          </Link>
        </p>
        {context ? <p className="mt-0.5 break-words text-xs text-fg-muted">{context}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular-nums">{formatDate(item.date)}</p>
        {info.text ? (
          <p className={cn('text-xs font-medium', toneText[info.tone])}>{info.text}</p>
        ) : null}
      </div>
    </li>
  );
}
