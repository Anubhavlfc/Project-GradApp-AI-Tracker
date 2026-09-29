import { Link } from 'react-router';
import { Card } from '@/components/ui';
import { DeadlineText, FeeText, PriorityBadge } from './ApplicationCells';
import { FavoriteButton } from './FavoriteButton';
import { applicationName, programLine } from './labels';
import type { ListActions } from './list-actions';
import { RowActions } from './RowActions';
import { StatusMenu } from './StatusMenu';
import type { ApplicationRecord } from './types';

type ApplicationCardsProps = ListActions & { records: readonly ApplicationRecord[]; today: string };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

/** The phone list: one card per program, with the same information and actions as a table row. */
export function ApplicationCards({
  records,
  today,
  onToggleFavorite,
  onChangeStatus,
  onDelete,
}: ApplicationCardsProps) {
  return (
    <ul aria-label="Applications" className="space-y-3">
      {records.map((record) => {
        const name = applicationName(record);
        return (
          <li key={record.id}>
            <Card className="p-4">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/app/applications/${record.id}`}
                    className="focus-ring break-words rounded-sm font-medium hover:underline"
                  >
                    {record.university.name}
                  </Link>
                  <p className="break-words text-fg-muted">{programLine(record)}</p>
                </div>
                <div className="-mr-2 -mt-2 flex shrink-0">
                  <FavoriteButton
                    name={name}
                    isFavorite={record.is_favorite}
                    onToggle={() => onToggleFavorite(record)}
                  />
                  <RowActions record={record} onDelete={onDelete} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                <Fact label="Deadline">
                  <DeadlineText record={record} today={today} />
                </Fact>
                <Fact label="Status">
                  <StatusMenu
                    wrap
                    status={record.status}
                    name={name}
                    onChange={(status) => onChangeStatus(record, status)}
                  />
                </Fact>
                <Fact label="Application fee">
                  <FeeText record={record} />
                </Fact>
                <Fact label="Priority">
                  <PriorityBadge priority={record.priority} />
                </Fact>
              </dl>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
