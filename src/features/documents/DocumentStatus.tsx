import { Badge, StatusPicker } from '@/components/ui';
import { DOCUMENT_STATUSES, getDocumentStatusMeta, type DocumentStatus } from './kinds';

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { label, tone } = getDocumentStatusMeta(status);
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

type DocumentStatusPickerProps = {
  status: DocumentStatus;
  /** What the status belongs to, for screen readers: "Resume, 2026". */
  name: string;
  onChange: (status: DocumentStatus) => void;
};

/** The status badge as a button: click it to move the document to another status. */
export function DocumentStatusPicker({ status, name, onChange }: DocumentStatusPickerProps) {
  return (
    <StatusPicker value={status} options={DOCUMENT_STATUSES} subject={name} onChange={onChange} />
  );
}
