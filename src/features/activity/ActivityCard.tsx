import {
  ClipboardCheck,
  Coins,
  FileText,
  FolderMinus,
  FolderPlus,
  Mail,
  ListChecks,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { formatDateTime } from '@/features/applications/dates';
import { CompactRow } from '@/features/dashboard/CompactRow';
import { DashboardCard } from '@/features/dashboard/DashboardCard';
import { gather } from '@/features/dashboard/gather';
import { describeActivity } from './describe';
import { useRecentActivity } from './hooks';
import { isActivityKind, type ActivityKind } from './kinds';
import { describeAge } from './time';

const icons: Record<ActivityKind, LucideIcon> = {
  application_added: FolderPlus,
  status_changed: RefreshCw,
  application_removed: FolderMinus,
  requirement_updated: ClipboardCheck,
  letter_updated: Mail,
  funding_updated: Coins,
  task_completed: ListChecks,
  document_completed: FileText,
};

/** The latest changes you made, newest first. */
export function ActivityCard() {
  const activity = useRecentActivity();
  const applications = useApplicationsQuery();
  // A program that has since been deleted has nowhere to link to.
  const programs = new Set(applications.data?.map((record) => record.id));
  return (
    <DashboardCard
      title="Recent activity"
      description="The latest changes you made."
      state={gather([activity])}
      failedTitle="Unable to load your activity"
    >
      {() => {
        const rows = activity.data ?? [];
        if (rows.length === 0) {
          return (
            <p className="p-4 text-fg-muted">
              Nothing yet. Changes you make to your programs, checklists, letters, funding and tasks
              will be listed here.
            </p>
          );
        }
        return (
          <ul aria-label="Recent activity" className="divide-y divide-border">
            {rows.map((row) => {
              const { headline, context, href } = describeActivity(row);
              const Icon = isActivityKind(row.kind) ? icons[row.kind] : RefreshCw;
              const reachable = row.application_id === null || programs.has(row.application_id);
              return (
                <CompactRow
                  key={row.id}
                  title={headline}
                  href={reachable ? href : null}
                  context={context}
                  leading={
                    <span className="mt-0.5 shrink-0 rounded-md bg-surface-muted p-1.5 text-fg-muted">
                      <Icon aria-hidden="true" className="size-4" />
                    </span>
                  }
                  trailing={
                    <time
                      dateTime={row.created_at}
                      title={formatDateTime(row.created_at)}
                      className="text-xs text-fg-muted"
                    >
                      {describeAge(row.created_at)}
                    </time>
                  }
                />
              );
            })}
          </ul>
        );
      }}
    </DashboardCard>
  );
}
