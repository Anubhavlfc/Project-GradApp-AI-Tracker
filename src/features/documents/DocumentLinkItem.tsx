import { useId } from 'react';
import { SafeLink, Select } from '@/components/ui';
import { requirementSubtitle, requirementTitle } from '@/features/requirements/progress';
import { RequirementStatusBadge } from '@/features/requirements/RequirementStatus';
import type { RequirementRow } from '@/features/requirements/types';
import { hostnameOf } from '@/lib/url';
import { DocumentStatusBadge } from './DocumentStatus';
import { linkOptions } from './logic';
import type { DocumentRow } from './types';

type DocumentLinkItemProps = {
  /** The checklist item the document is for. */
  row: RequirementRow;
  documents: readonly DocumentRow[];
  onLink: (row: RequirementRow, documentId: string | null) => void;
};

function Options({ documents }: { documents: readonly DocumentRow[] }) {
  return documents.map((document) => (
    <option key={document.id} value={document.id}>
      {document.name}
    </option>
  ));
}

/** One checklist item that needs a document, with a choice of which of your documents to use. */
export function DocumentLinkItem({ row, documents, onLink }: DocumentLinkItemProps) {
  const selectId = useId();
  const title = requirementTitle(row);
  const subtitle = requirementSubtitle(row);
  const { suggested, others } = linkOptions(row.kind, documents);
  const linked = documents.find((document) => document.id === row.document_id) ?? null;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0 flex-1 basis-56">
          <p className="break-words font-medium leading-6">{title}</p>
          {subtitle ? <p className="text-xs text-fg-muted">{subtitle}</p> : null}
        </div>
        <RequirementStatusBadge status={row.status} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={selectId} className="mb-1 block text-xs font-medium text-fg-muted">
            Document <span className="sr-only">for {title}</span>
          </label>
          <Select
            id={selectId}
            value={row.document_id ?? ''}
            onChange={(event) => onLink(row, event.target.value || null)}
          >
            <option value="">No document chosen</option>
            {suggested.length > 0 ? (
              <optgroup label="Suggested">
                <Options documents={suggested} />
              </optgroup>
            ) : null}
            {others.length > 0 ? (
              <optgroup label={suggested.length > 0 ? 'Other documents' : 'Your documents'}>
                <Options documents={others} />
              </optgroup>
            ) : null}
          </Select>
        </div>
        {linked ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:pt-5">
            <DocumentStatusBadge status={linked.status} />
            {linked.url ? (
              <span className="text-xs">
                <SafeLink href={linked.url}>{hostnameOf(linked.url)}</SafeLink>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
