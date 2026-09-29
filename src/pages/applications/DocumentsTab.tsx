import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { DocumentDialog, type DocumentTarget } from '@/features/documents/DocumentDialog';
import { DocumentLinkItem } from '@/features/documents/DocumentLinkItem';
import {
  useApplicationDocumentItems,
  useDocumentLinks,
  useSortedDocuments,
} from '@/features/documents/hooks';
import { toDataError } from '@/lib/dataError';

function DocumentsSkeleton() {
  return (
    <SkeletonRegion label="Loading documents">
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

/**
 * The documents a program asks for: each checklist item that needs one, with a choice of which of
 * your documents to send for it. The documents themselves live on the Documents page.
 */
export function DocumentsTab() {
  const record = useApplicationRecord();
  const itemsQuery = useApplicationDocumentItems(record.id);
  const documentsQuery = useSortedDocuments();
  const links = useDocumentLinks();

  const [editing, setEditing] = useState<DocumentTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items = itemsQuery.data;
  const documents = documentsQuery.data;
  const failed =
    (items === undefined && itemsQuery.isError) ||
    (documents === undefined && documentsQuery.isError);

  function retry() {
    void itemsQuery.refetch();
    void documentsQuery.refetch();
  }

  function renderBody() {
    if (items === undefined || documents === undefined) {
      return failed ? (
        <Alert
          kind="danger"
          title="Unable to load documents"
          action={
            <Button size="sm" onClick={retry}>
              Try again
            </Button>
          }
        >
          {toDataError(itemsQuery.error ?? documentsQuery.error).message}
        </Alert>
      ) : (
        <DocumentsSkeleton />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          icon={FileText}
          title="No document items on this checklist yet."
          description="Add items like a resume, a statement of purpose or a transcript to this program's requirements, then come back here to choose which of your documents you will send for each."
          action={
            <ButtonLink to={`/app/applications/${record.id}/requirements`} variant="primary">
              Go to requirements
            </ButtonLink>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {itemsQuery.isError || documentsQuery.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh documents"
            action={
              <Button size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded.{' '}
            {toDataError(itemsQuery.error ?? documentsQuery.error).message}
          </Alert>
        ) : null}

        {documents.length === 0 ? (
          <Alert
            kind="info"
            title="You haven't added any documents yet."
            action={
              <Button size="sm" onClick={() => setEditing({ kind: 'new' })}>
                Add a document
              </Button>
            }
          >
            Add your resume, statement or transcript once, then choose it for every program that
            asks for it.
          </Alert>
        ) : null}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Documents for this program</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                Choose which of your documents you will send for each item.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ButtonLink to="/app/documents" size="sm">
                All documents
              </ButtonLink>
              <Button size="sm" variant="primary" onClick={() => setEditing({ kind: 'new' })}>
                <Plus aria-hidden="true" className="size-4" />
                Add document
              </Button>
            </div>
          </div>
          <ul aria-label="Documents for this program" className="divide-y divide-border">
            {items.map((row) => (
              <DocumentLinkItem key={row.id} row={row} documents={documents} onLink={links.link} />
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {notice ? (
          <Alert
            kind="success"
            title={notice}
            action={
              <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
                Dismiss
              </Button>
            }
          />
        ) : null}

        {links.error ? (
          <Alert
            kind="danger"
            title="Couldn't change that document"
            action={
              <Button size="sm" variant="ghost" onClick={links.clearError}>
                Dismiss
              </Button>
            }
          >
            {links.error}
          </Alert>
        ) : null}

        {renderBody()}
      </div>

      <DocumentDialog target={editing} onClose={() => setEditing(null)} onSaved={setNotice} />
    </>
  );
}
