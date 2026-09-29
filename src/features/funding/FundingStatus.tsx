import { Badge, StatusPicker } from '@/components/ui';
import { FUNDING_STATUSES, getFundingStatusMeta, type FundingStatus } from './kinds';

export function FundingStatusBadge({ status }: { status: FundingStatus }) {
  const { label, tone } = getFundingStatusMeta(status);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

type FundingStatusPickerProps = {
  status: FundingStatus;
  /** What the status belongs to, for screen readers: "Departmental fellowship". */
  name: string;
  onChange: (status: FundingStatus) => void;
};

/** The status badge as a button: click it to move the item to another status. */
export function FundingStatusPicker({ status, name, onChange }: FundingStatusPickerProps) {
  return (
    <StatusPicker value={status} options={FUNDING_STATUSES} subject={name} onChange={onChange} />
  );
}
