import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useRequirementsApi } from '@/features/requirements/api-context';
import { useRequirementsQuery } from '@/features/requirements/hooks';
import { useRequirementsKey } from '@/features/requirements/keys';
import type { RequirementRow } from '@/features/requirements/types';
import { describeDataError, toDataError } from '@/lib/dataError';
import { upsertRow } from '@/lib/rows';
import { useQuickChange } from '@/lib/useQuickChange';
import { useDocumentsApi } from './api-context';
import { useDocumentsKey } from './keys';
import type { DocumentStatus } from './kinds';
import { documentItems, documentUsage, sortDocuments, type UsageLookup } from './logic';
import type { DocumentFields, DocumentRow } from './types';

// Like programs and checklists, documents are read from one cached list. The Documents page, a
// program's Documents tab and the "used for" counts all read from it, so they can never disagree,
// and a change on one shows on the others at once.

export function useDocumentsQuery<T = DocumentRow[]>(select?: (rows: DocumentRow[]) => T) {
  const api = useDocumentsApi();
  const { state } = useAuth();
  return useQuery({
    queryKey: useDocumentsKey(),
    queryFn: () => api.list(),
    enabled: state.status === 'signed_in',
    select,
  });
}

/** Every document, in the order they are listed. */
export function useSortedDocuments() {
  return useDocumentsQuery(sortDocuments);
}

const NO_USAGE: ReadonlyMap<string, number> = new Map();

/** How many checklist items use each document. `retry` asks the server again. */
export function useDocumentUsage(): UsageLookup & { retry: () => void } {
  const { data, isError, refetch } = useRequirementsQuery(documentUsage);
  return useMemo(
    () => ({
      status: data ? 'ready' : isError ? 'unavailable' : 'loading',
      byDocument: data ?? NO_USAGE,
      retry: () => void refetch(),
    }),
    [data, isError, refetch],
  );
}

/** The message for a failed document request. */
export function documentErrorMessage(error: unknown): string {
  return describeDataError(error, 'document');
}

function codeOf(cause: unknown): string {
  return typeof cause === 'object' && cause !== null
    ? String((cause as Record<string, unknown>).code ?? '')
    : '';
}

/** The message for a checklist item that could not be linked to a document. */
export function linkErrorMessage(error: unknown): string {
  const failure = toDataError(error);
  if (codeOf(failure.cause) === '23503') {
    return 'That document was deleted in another tab. Reload the page and try again.';
  }
  return describeDataError(failure, 'checklist item');
}

/** Adds a document, or saves changes to one when `id` is given. Resolves with the saved document. */
export function useSaveDocument() {
  const api = useDocumentsApi();
  const queryClient = useQueryClient();
  const key = useDocumentsKey();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: DocumentFields }) =>
      id ? api.update(id, fields) : api.create(fields),
    onSuccess: (saved) => {
      queryClient.setQueryData<DocumentRow[]>(key, (old) => old && upsertRow(old, saved));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Adds several documents in one request. Resolves with the new documents. */
export function useAddDocuments() {
  const api = useDocumentsApi();
  const queryClient = useQueryClient();
  const key = useDocumentsKey();
  return useMutation({
    mutationFn: (items: readonly DocumentFields[]) => api.createMany(items),
    onSuccess: (created) => {
      queryClient.setQueryData<DocumentRow[]>(key, (old) => old && [...old, ...created]);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Deletes a document. The database keeps the checklist items that used it and only clears their
 * link, so the same is done to the remembered checklist, and the real one is read again.
 */
export function useDeleteDocument() {
  const api = useDocumentsApi();
  const queryClient = useQueryClient();
  const key = useDocumentsKey();
  const requirementsKey = useRequirementsKey();
  return useMutation({
    mutationFn: (id: string) => api.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<DocumentRow[]>(
        key,
        (old) => old && old.filter((row) => row.id !== id),
      );
      queryClient.setQueryData<RequirementRow[]>(
        requirementsKey,
        (old) =>
          old && old.map((row) => (row.document_id === id ? { ...row, document_id: null } : row)),
      );
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: requirementsKey });
    },
  });
}

/**
 * The one-click change made on a document: its status. It shows immediately and is undone, with a
 * message, if the server refuses.
 */
export function useDocumentActions() {
  const api = useDocumentsApi();
  const quick = useQuickChange<DocumentRow, { status: DocumentStatus }>({
    key: useDocumentsKey(),
    scope: 'document-status',
    send: (id, { status }) => api.setStatus(id, status),
    errorMessage: documentErrorMessage,
  });

  return {
    setStatus(shown: DocumentRow, status: DocumentStatus) {
      quick.change(shown, (row) => (row.status === status ? null : { status }));
    },
    /** Message for the last change that failed, until the next change starts. */
    error: quick.error,
    clearError: quick.clearError,
  };
}

/**
 * Choosing which document a checklist item uses (or none). It shows immediately and is undone,
 * with a message, if the server refuses.
 */
export function useDocumentLinks() {
  const api = useRequirementsApi();
  const quick = useQuickChange<RequirementRow, { document_id: string | null }>({
    key: useRequirementsKey(),
    scope: 'requirement-document',
    send: (id, { document_id }) => api.setDocument(id, document_id),
    errorMessage: linkErrorMessage,
  });

  return {
    link(shown: RequirementRow, documentId: string | null) {
      quick.change(shown, (row) =>
        row.document_id === documentId ? null : { document_id: documentId },
      );
    },
    /** Message for the last change that failed, until the next change starts. */
    error: quick.error,
    clearError: quick.clearError,
  };
}

/** One program's checklist items that a document can be attached to, in checklist order. */
export function useApplicationDocumentItems(applicationId: string) {
  const select = useCallback(
    (rows: RequirementRow[]) =>
      documentItems(rows.filter((row) => row.application_id === applicationId)),
    [applicationId],
  );
  return useRequirementsQuery(select);
}
