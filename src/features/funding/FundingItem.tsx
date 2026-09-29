import { Link } from 'react-router';
import { ItemMenu, SafeLink } from '@/components/ui';
import { applicationName } from '@/features/applications/labels';
import { formatMoney } from '@/features/applications/money';
import type { ApplicationRecord } from '@/features/applications/types';
import { hostnameOf } from '@/lib/url';
import { FundingDeadline } from './FundingDeadline';
import { FundingStatusPicker } from './FundingStatus';
import { fundingKindLabel, type FundingStatus } from './kinds';
import type { FundingRow } from './types';

export type FundingActions = {
  onChangeStatus: (item: FundingRow, status: FundingStatus) => void;
  onEdit: (item: FundingRow) => void;
  onDelete: (item: FundingRow) => void;
};

type FundingItemProps = FundingActions & {
  item: FundingRow;
  /**
   * The program the item belongs to. On a program's own page this is that program and is not
   * repeated; on the Funding page it is named, with a link. Null when tied to none.
   */
  application: ApplicationRecord | null;
  /** True on the Funding page, where the program (or "no program") is named on every row. */
  showProgram: boolean;
  today: string;
};

/** One funding item: what it is, how much, when to apply by, and where it stands. */
export function FundingItem({
  item,
  application,
  showProgram,
  today,
  onChangeStatus,
  onEdit,
  onDelete,
}: FundingItemProps) {
  const subject = item.name;
  const program =
    item.application_id === null ? (
      'Not tied to a program'
    ) : application ? (
      <Link
        to={`/app/applications/${application.id}/funding`}
        className="focus-ring rounded-sm hover:underline"
      >
        {applicationName(application)}
      </Link>
    ) : (
      'Unknown program'
    );

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="break-words font-medium leading-6">{item.name}</p>
        <p className="text-xs text-fg-muted">
          {fundingKindLabel(item.kind)}
          {item.amount !== null ? (
            <>
              {' · '}
              <span className="font-medium tabular-nums text-fg">
                {formatMoney(item.amount, item.currency)}
              </span>
            </>
          ) : null}
          {item.application_required ? ' · Application required' : null}
        </p>
        {showProgram ? <p className="break-words text-xs text-fg-muted">{program}</p> : null}
        <FundingDeadline
          item={item}
          applicationStatus={application?.status ?? null}
          today={today}
        />
        {item.url ? (
          <p className="text-xs">
            <SafeLink href={item.url}>{hostnameOf(item.url)}</SafeLink>
          </p>
        ) : null}
        {item.notes ? (
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">
            {item.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:-my-1.5">
        <FundingStatusPicker
          status={item.status}
          name={subject}
          onChange={(status) => onChangeStatus(item, status)}
        />
        <ItemMenu
          subject={subject}
          editLabel="Edit funding"
          deleteLabel="Delete funding…"
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
        />
      </div>
    </li>
  );
}
