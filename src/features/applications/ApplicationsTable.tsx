import { Link } from 'react-router';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import { FundingCell } from '@/features/funding/FundingCell';
import type { FundingLookup } from '@/features/funding/logic';
import { CompletionCell } from '@/features/requirements/CompletionMeter';
import type { ProgressLookup } from '@/features/requirements/progress';
import { DeadlineText, FeeText, PriorityBadge } from './ApplicationCells';
import { FavoriteButton } from './FavoriteButton';
import { applicationName, programLine } from './labels';
import type { ListActions } from './list-actions';
import { RowActions } from './RowActions';
import { StatusMenu } from './StatusMenu';
import type { ApplicationRecord } from './types';
import type { SortKey, ViewState } from './view';

type ApplicationsTableProps = ListActions & {
  records: readonly ApplicationRecord[];
  view: ViewState;
  today: string;
  /** How far along each program's checklist is. */
  progress: ProgressLookup;
  /** Which programs have funding. */
  funding: FundingLookup;
  onSort: (key: SortKey) => void;
};

/** The desktop list: one row per program, sortable by clicking a column heading. */
export function ApplicationsTable({
  records,
  view,
  today,
  progress,
  funding,
  onSort,
  onToggleFavorite,
  onChangeStatus,
  onDelete,
}: ApplicationsTableProps) {
  const sortable = (key: SortKey) => ({
    sortDirection: view.sort === key ? view.direction : null,
    onSort: () => onSort(key),
  });

  return (
    <TableContainer label="Applications">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell className="w-12">
              <span className="sr-only">Favorite</span>
            </TableHeaderCell>
            <TableHeaderCell {...sortable('university')}>University and program</TableHeaderCell>
            <TableHeaderCell {...sortable('deadline')}>Deadline</TableHeaderCell>
            <TableHeaderCell {...sortable('status')}>Status</TableHeaderCell>
            <TableHeaderCell {...sortable('completion')}>Completion</TableHeaderCell>
            <TableHeaderCell {...sortable('fee')}>Application fee</TableHeaderCell>
            <TableHeaderCell>Funding</TableHeaderCell>
            <TableHeaderCell {...sortable('priority')}>Priority</TableHeaderCell>
            <TableHeaderCell className="w-12">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {records.map((record) => {
            const name = applicationName(record);
            return (
              <TableRow key={record.id}>
                <TableCell>
                  <FavoriteButton
                    name={name}
                    isFavorite={record.is_favorite}
                    onToggle={() => onToggleFavorite(record)}
                  />
                </TableCell>
                <TableCell className="min-w-56 max-w-80">
                  <Link
                    to={`/app/applications/${record.id}`}
                    className="focus-ring rounded-sm font-medium hover:underline"
                  >
                    {record.university.name}
                  </Link>
                  <div className="truncate text-fg-muted">{programLine(record)}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <DeadlineText record={record} today={today} />
                </TableCell>
                <TableCell>
                  <StatusMenu
                    status={record.status}
                    name={name}
                    onChange={(status) => onChangeStatus(record, status)}
                  />
                </TableCell>
                <TableCell>
                  <CompletionCell
                    status={progress.status}
                    completion={progress.byApplication.get(record.id)}
                    name={name}
                  />
                </TableCell>
                <TableCell>
                  <FeeText record={record} />
                </TableCell>
                <TableCell>
                  <FundingCell
                    status={funding.status}
                    funding={funding.byApplication.get(record.id)}
                  />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={record.priority} />
                </TableCell>
                <TableCell>
                  <RowActions record={record} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
