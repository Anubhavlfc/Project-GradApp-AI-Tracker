import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { CommonDocumentsDialog } from '@/features/documents/CommonDocumentsDialog';
import { DeleteDocumentDialog } from '@/features/documents/DeleteDocumentDialog';
import { DocumentDialog, type DocumentTarget } from '@/features/documents/DocumentDialog';
import { DocumentItem } from '@/features/documents/DocumentItem';
import { DocumentsSummary } from '@/features/documents/DocumentsSummary';
import {
  useDocumentActions,
  useDocumentUsage,
  useSortedDocuments,
} from '@/features/documents/hooks';
import { COMMON_DOCUMENTS } from '@/features/documents/kinds';
import { summarizeDocuments } from '@/features/documents/logic';
import type { DocumentRow } from '@/features/documents/types';
import { toDataError } from '@/lib/dataError';

function ListSkeleton() {
  return (
    <SkeletonRegion label="Loading documents">
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Everything you send with your applications, in one place: resume, statements, transcripts... */
export function DocumentsPage() {
  const query = useSortedDocuments();
  const usage = useDocumentUsage();
  const actions = useDocumentActions();

  const [editing, setEditing] = useState<DocumentTarget | null>(null);
  const [picking, setPicking] = useState(false);
  const [toDelete, setToDelete] = useState<DocumentRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const documents = query.data;
  const usedBy = (document: DocumentRow) =>
    usage.status === 'ready' ? (usage.byDocument.get(document.id) ?? 0) : null;
  const canAddUsual =
    documents !== undefined &&
    COMMON_DOCUMENTS.some((item) => !documents.some((document) => document.kind === item.kind));

  function renderBody() {
    if (documents === undefined) {
      return query.isError ? (
        <Alert
          kind="danger"
          title="Unable to load documents"
          action={
            <Button size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        >
          {toDataError(query.error).message}
        </Alert>
      ) : (
        <ListSkeleton />
      );
    }

    if (documents.length === 0) {
      return (
        <EmptyState
          icon={FileText}
          title="No documents yet."
          description="List what you send with your applications, like a resume, a statement of purpose or a transcript. Add a link to where each file lives and mark it complete when it is ready."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setPicking(true)}>
                Add the usual documents
              </Button>
              <Button onClick={() => setEditing({ kind: 'new' })}>Add a document</Button>
            </div>
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        {query.isError ? (
          <Alert
            kind="warning"
            title="Unable to refresh documents"
            action={
              <Button size="sm" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          >
            Showing the last list that loaded. {toDataError(query.error).message}
          </Alert>
        ) : null}

        {usage.status === 'unavailable' ? (
          <Alert
            kind="warning"
            title="Can't tell where your documents are used"
            action={
              <Button size="sm" onClick={usage.retry}>
                Try again
              </Button>
            }
          >
            The list below is complete, but it doesn't show which checklist items use each document.
          </Alert>
        ) : null}

        <DocumentsSummary progress={summarizeDocuments(documents)} />

        <Card>
          <ul aria-label="Documents" className="divide-y divide-border">
            {documents.map((document) => (
              <DocumentItem
                key={document.id}
                document={document}
                usedBy={usedBy(document)}
                onChangeStatus={actions.setStatus}
                onEdit={(row) => setEditing({ kind: 'edit', item: row })}
                onDelete={setToDelete}
              />
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Documents"
        description="What you send with your applications, and how far along each one is."
        actions={
          documents !== undefined && documents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {canAddUsual ? (
                <Button onClick={() => setPicking(true)}>Add the usual documents</Button>
              ) : null}
              <Button variant="primary" onClick={() => setEditing({ kind: 'new' })}>
                <Plus aria-hidden="true" className="size-4" />
                Add document
              </Button>
            </div>
          ) : undefined
        }
      />

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

        {actions.error ? (
          <Alert
            kind="danger"
            title="Couldn't update that document"
            action={
              <Button size="sm" variant="ghost" onClick={actions.clearError}>
                Dismiss
              </Button>
            }
          >
            {actions.error}
          </Alert>
        ) : null}

        {renderBody()}
      </div>

      <DocumentDialog target={editing} onClose={() => setEditing(null)} onSaved={setNotice} />
      <CommonDocumentsDialog
        open={picking}
        documents={documents ?? []}
        onClose={() => setPicking(false)}
        onAdded={setNotice}
      />
      <DeleteDocumentDialog
        document={toDelete}
        usedBy={toDelete ? usedBy(toDelete) : null}
        onClose={() => setToDelete(null)}
        onDeleted={(document) => {
          setToDelete(null);
          setNotice(`Deleted ${document.name}.`);
        }}
      />
    </>
  );
}
