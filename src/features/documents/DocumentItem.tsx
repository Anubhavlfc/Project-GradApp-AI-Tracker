import { ItemMenu, SafeLink } from '@/components/ui';
import { hostnameOf } from '@/lib/url';
import { DocumentStatusPicker } from './DocumentStatus';
import { documentKindLabel, type DocumentStatus } from './kinds';
import type { DocumentRow } from './types';

export type DocumentActions = {
  onChangeStatus: (document: DocumentRow, status: DocumentStatus) => void;
  onEdit: (document: DocumentRow) => void;
  onDelete: (document: DocumentRow) => void;
};

type DocumentItemProps = DocumentActions & {
  document: DocumentRow;
  /** How many checklist items use it; null when that is not known (still loading, or failed). */
  usedBy: number | null;
};

function usedByText(count: number): string {
  return `Used for ${count} ${count === 1 ? 'checklist item' : 'checklist items'}`;
}

/** One document: what it is, where it lives, how far along it is, and where it is used. */
export function DocumentItem({
  document,
  usedBy,
  onChangeStatus,
  onEdit,
  onDelete,
}: DocumentItemProps) {
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="break-words font-medium leading-6">{document.name}</p>
        <p className="text-xs text-fg-muted">
          {documentKindLabel(document.kind)}
          {usedBy ? ` · ${usedByText(usedBy)}` : null}
        </p>
        {document.url ? (
          <p className="text-xs">
            <SafeLink href={document.url}>{hostnameOf(document.url)}</SafeLink>
          </p>
        ) : null}
        {document.notes ? (
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-fg-muted">
            {document.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:-my-1.5">
        <DocumentStatusPicker
          status={document.status}
          name={document.name}
          onChange={(status) => onChangeStatus(document, status)}
        />
        <ItemMenu
          subject={document.name}
          editLabel="Edit document"
          deleteLabel="Delete document…"
          onEdit={() => onEdit(document)}
          onDelete={() => onDelete(document)}
        />
      </div>
    </li>
  );
}
