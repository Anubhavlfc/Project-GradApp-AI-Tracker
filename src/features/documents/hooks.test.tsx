import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/useAuth';
import { RequirementsApiContext } from '@/features/requirements/api-context';
import type { RequirementRow } from '@/features/requirements/types';
import { DataError } from '@/lib/dataError';
import { createQueryClient } from '@/lib/queryClient';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeDocumentsApi, fakeDocument } from '@/test/fakeDocumentsApi';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { DocumentsApiContext } from './api-context';
import {
  documentErrorMessage,
  linkErrorMessage,
  useAddDocuments,
  useApplicationDocumentItems,
  useDeleteDocument,
  useDocumentActions,
  useDocumentLinks,
  useDocumentUsage,
  useSaveDocument,
} from './hooks';
import type { DocumentFields, DocumentRow } from './types';

const DOCUMENTS_KEY = ['documents', 'user-1'];
const REQUIREMENTS_KEY = ['requirements', 'user-1'];

type Options = {
  documents?: DocumentRow[];
  requirements?: RequirementRow[];
  /** Put the lists in the cache up front (the default), as if the page had loaded them. */
  cached?: boolean;
};

/** The hooks for someone who is signed in, with the lists already in the cache unless `cached` is false. */
async function setup<T>(
  useHook: () => T,
  { documents = [], requirements = [], cached = true }: Options = {},
) {
  const documentsFake = createFakeDocumentsApi(documents);
  const requirementsFake = createFakeRequirementsApi(requirements);
  const queryClient = createQueryClient({ retry: false });
  if (cached) {
    queryClient.setQueryData(DOCUMENTS_KEY, structuredClone(documents));
    queryClient.setQueryData(REQUIREMENTS_KEY, structuredClone(requirements));
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider client={createFakeAuth(fakeSession()).client}>
      <DocumentsApiContext value={documentsFake.api}>
        <RequirementsApiContext value={requirementsFake.api}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </RequirementsApiContext>
      </DocumentsApiContext>
    </AuthProvider>
  );
  const hook = renderHook(() => ({ value: useHook(), auth: useAuth() }), { wrapper });
  await waitFor(() => expect(hook.result.current.auth.state.status).toBe('signed_in'));
  return { documentsFake, requirementsFake, queryClient, ...hook };
}

type Client = ReturnType<typeof createQueryClient>;
const cachedDocuments = (queryClient: Client) =>
  queryClient.getQueryData<DocumentRow[]>(DOCUMENTS_KEY);
const cachedRequirements = (queryClient: Client) =>
  queryClient.getQueryData<RequirementRow[]>(REQUIREMENTS_KEY);

const fields = (overrides: Partial<DocumentFields> = {}): DocumentFields => ({
  name: 'Resume',
  kind: 'resume',
  status: 'not_started',
  url: null,
  notes: null,
  ...overrides,
});

describe('useDocumentActions', () => {
  it('sends a status change once', async () => {
    const row = fakeDocument({ status: 'in_progress' });
    const { documentsFake, result } = await setup(useDocumentActions, { documents: [row] });
    result.current.value.setStatus(row, 'complete');
    await waitFor(() => expect(documentsFake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(documentsFake.api.setStatus).toHaveBeenCalledWith(row.id, 'complete');
  });

  it('sends nothing for the status the document already has', async () => {
    const row = fakeDocument({ status: 'complete' });
    const { documentsFake, result } = await setup(useDocumentActions, { documents: [row] });
    result.current.value.setStatus(row, 'complete');
    await waitFor(() => expect(result.current.value.error).toBeNull());
    expect(documentsFake.api.setStatus).not.toHaveBeenCalled();
  });

  it('judges a change by the document as it is now, not by the row the click came from', async () => {
    // The page still shows "Not Started", but a change to Complete has already gone through.
    const shown = fakeDocument({ status: 'not_started' });
    const { documentsFake, result } = await setup(useDocumentActions, {
      documents: [{ ...shown, status: 'complete' }],
    });
    result.current.value.setStatus(shown, 'complete');
    expect(documentsFake.api.setStatus).not.toHaveBeenCalled();
    result.current.value.setStatus(shown, 'not_started');
    await waitFor(() => expect(documentsFake.api.setStatus).toHaveBeenCalledTimes(1));
    expect(documentsFake.api.setStatus).toHaveBeenCalledWith(shown.id, 'not_started');
  });

  it('shows the new status at once', async () => {
    const row = fakeDocument({ status: 'in_progress' });
    const { documentsFake, result, queryClient } = await setup(useDocumentActions, {
      documents: [row],
    });
    documentsFake.api.setStatus.mockImplementationOnce(() => new Promise(() => {}));
    act(() => result.current.value.setStatus(row, 'complete'));
    await waitFor(() => expect(cachedDocuments(queryClient)?.[0]?.status).toBe('complete'));
    expect(documentsFake.api.setStatus).toHaveBeenCalledTimes(1);
  });

  it('puts the old status back and says why when the server refuses', async () => {
    const row = fakeDocument({ status: 'in_progress' });
    const { documentsFake, result, queryClient } = await setup(useDocumentActions, {
      documents: [row],
    });
    documentsFake.api.setStatus.mockRejectedValueOnce(new DataError('network'));
    result.current.value.setStatus(row, 'complete');
    await waitFor(() => expect(result.current.value.error).toMatch(/Can't reach the server/));
    expect(cachedDocuments(queryClient)?.[0]?.status).toBe('in_progress');
    act(() => result.current.value.clearError());
    expect(result.current.value.error).toBeNull();
  });

  it('says so when the document was deleted elsewhere in the meantime', async () => {
    const row = fakeDocument({ status: 'in_progress' });
    const { documentsFake, result } = await setup(useDocumentActions, { documents: [row] });
    documentsFake.api.setStatus.mockRejectedValueOnce(new DataError('not_found'));
    result.current.value.setStatus(row, 'complete');
    await waitFor(() =>
      expect(result.current.value.error).toMatch(/That document no longer exists/),
    );
  });
});

describe('useSaveDocument', () => {
  it('adds a new document to the cached list', async () => {
    const existing = fakeDocument({ name: 'Existing' });
    const { result, queryClient } = await setup(useSaveDocument, { documents: [existing] });
    const saved = await act(() => result.current.value.mutateAsync({ fields: fields() }));
    expect(saved).toMatchObject({ name: 'Resume' });
    expect(cachedDocuments(queryClient)?.map((row) => row.name)).toEqual(['Existing', 'Resume']);
  });

  it('replaces the old copy when saving changes to a document', async () => {
    const row = fakeDocument({ status: 'in_progress' });
    const { documentsFake, result, queryClient } = await setup(useSaveDocument, {
      documents: [row],
    });
    await act(() =>
      result.current.value.mutateAsync({
        id: row.id,
        fields: fields({ name: row.name, status: 'complete', url: 'https://example.com/cv' }),
      }),
    );
    expect(documentsFake.api.update).toHaveBeenCalledWith(
      row.id,
      expect.objectContaining({ status: 'complete', url: 'https://example.com/cv' }),
    );
    const cached = cachedDocuments(queryClient)!;
    expect(cached).toHaveLength(1);
    expect(cached[0]).toMatchObject({ id: row.id, status: 'complete' });
  });

  it('leaves the cache alone when saving fails', async () => {
    const row = fakeDocument();
    const { documentsFake, result, queryClient } = await setup(useSaveDocument, {
      documents: [row],
    });
    documentsFake.api.create.mockRejectedValueOnce(new DataError('network'));
    await expect(
      act(() => result.current.value.mutateAsync({ fields: fields() })),
    ).rejects.toMatchObject({ kind: 'network' });
    expect(cachedDocuments(queryClient)).toEqual([row]);
  });

  it('does not invent a list when none has loaded yet', async () => {
    const { result, queryClient } = await setup(useSaveDocument, { cached: false });
    await act(() => result.current.value.mutateAsync({ fields: fields() }));
    // Nothing to add it to, so it comes from the server on the next read instead.
    await waitFor(() => expect(cachedDocuments(queryClient)).toBeUndefined());
  });
});

describe('useAddDocuments', () => {
  it('adds all of them to the cached list with one request', async () => {
    const existing = fakeDocument({ name: 'Existing' });
    const { documentsFake, result, queryClient } = await setup(useAddDocuments, {
      documents: [existing],
    });
    const created = await act(() =>
      result.current.value.mutateAsync([
        fields({ name: 'Resume' }),
        fields({ name: 'Transcript', kind: 'transcript' }),
      ]),
    );
    expect(created).toHaveLength(2);
    expect(documentsFake.api.createMany).toHaveBeenCalledTimes(1);
    expect(cachedDocuments(queryClient)?.map((row) => row.name)).toEqual([
      'Existing',
      'Resume',
      'Transcript',
    ]);
  });

  it('leaves the cache alone when the server refuses', async () => {
    const existing = fakeDocument();
    const { documentsFake, result, queryClient } = await setup(useAddDocuments, {
      documents: [existing],
    });
    documentsFake.api.createMany.mockRejectedValueOnce(new DataError('network'));
    await expect(act(() => result.current.value.mutateAsync([fields()]))).rejects.toMatchObject({
      kind: 'network',
    });
    expect(cachedDocuments(queryClient)).toEqual([existing]);
  });
});

describe('useDeleteDocument', () => {
  it('takes the document out of the cached list', async () => {
    const [keep, drop] = [fakeDocument({ name: 'Keep' }), fakeDocument({ name: 'Drop' })];
    const { documentsFake, result, queryClient } = await setup(useDeleteDocument, {
      documents: [keep, drop],
    });
    await act(() => result.current.value.mutateAsync(drop.id));
    expect(documentsFake.api.remove).toHaveBeenCalledWith(drop.id);
    expect(cachedDocuments(queryClient)?.map((row) => row.name)).toEqual(['Keep']);
  });

  it('keeps the checklist items that used it, and only clears their link', async () => {
    const [keep, drop] = [fakeDocument({ name: 'Keep' }), fakeDocument({ name: 'Drop' })];
    const requirements = [
      fakeRequirement({ id: 'uses-drop', document_id: drop.id, status: 'complete' }),
      fakeRequirement({ id: 'uses-keep', document_id: keep.id }),
      fakeRequirement({ id: 'uses-none', document_id: null }),
    ];
    const { result, queryClient } = await setup(useDeleteDocument, {
      documents: [keep, drop],
      requirements,
    });
    await act(() => result.current.value.mutateAsync(drop.id));
    expect(
      cachedRequirements(queryClient)?.map((row) => [row.id, row.document_id, row.status]),
    ).toEqual([
      ['uses-drop', null, 'complete'],
      ['uses-keep', keep.id, 'not_started'],
      ['uses-none', null, 'not_started'],
    ]);
  });

  it('keeps everything when the server refuses', async () => {
    const row = fakeDocument();
    const item = fakeRequirement({ document_id: row.id });
    const { documentsFake, result, queryClient } = await setup(useDeleteDocument, {
      documents: [row],
      requirements: [item],
    });
    documentsFake.api.remove.mockRejectedValueOnce(new DataError('network'));
    await expect(act(() => result.current.value.mutateAsync(row.id))).rejects.toBeDefined();
    expect(cachedDocuments(queryClient)).toEqual([row]);
    expect(cachedRequirements(queryClient)).toEqual([item]);
  });
});

describe('useDocumentLinks', () => {
  it('sends the choice once', async () => {
    const [document, item] = [fakeDocument(), fakeRequirement()];
    const { requirementsFake, result } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    result.current.value.link(item, document.id);
    await waitFor(() => expect(requirementsFake.api.setDocument).toHaveBeenCalledTimes(1));
    expect(requirementsFake.api.setDocument).toHaveBeenCalledWith(item.id, document.id);
  });

  it('sends nothing when the item already uses that document', async () => {
    const document = fakeDocument();
    const item = fakeRequirement({ document_id: document.id });
    const { requirementsFake, result } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    result.current.value.link(item, document.id);
    await waitFor(() => expect(result.current.value.error).toBeNull());
    expect(requirementsFake.api.setDocument).not.toHaveBeenCalled();
  });

  it('can choose no document at all', async () => {
    const document = fakeDocument();
    const item = fakeRequirement({ document_id: document.id });
    const { requirementsFake, result, queryClient } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    result.current.value.link(item, null);
    await waitFor(() =>
      expect(requirementsFake.api.setDocument).toHaveBeenCalledWith(item.id, null),
    );
    await waitFor(() => expect(cachedRequirements(queryClient)?.[0]?.document_id).toBeNull());
  });

  it('shows the choice at once, and changes nothing else about the item', async () => {
    const [document, item] = [
      fakeDocument(),
      fakeRequirement({ status: 'in_progress', notes: 'x' }),
    ];
    const { requirementsFake, result, queryClient } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    requirementsFake.api.setDocument.mockImplementationOnce(() => new Promise(() => {}));
    act(() => result.current.value.link(item, document.id));
    await waitFor(() =>
      expect(cachedRequirements(queryClient)?.[0]).toMatchObject({
        document_id: document.id,
        status: 'in_progress',
        notes: 'x',
      }),
    );
  });

  it('puts the old choice back and says why when the server refuses', async () => {
    const [document, item] = [fakeDocument(), fakeRequirement()];
    const { requirementsFake, result, queryClient } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    requirementsFake.api.setDocument.mockRejectedValueOnce(new DataError('network'));
    result.current.value.link(item, document.id);
    await waitFor(() => expect(result.current.value.error).toMatch(/Can't reach the server/));
    expect(cachedRequirements(queryClient)?.[0]?.document_id).toBeNull();
    act(() => result.current.value.clearError());
    expect(result.current.value.error).toBeNull();
  });

  it('explains a document that was deleted in another tab', async () => {
    const [document, item] = [fakeDocument(), fakeRequirement()];
    const { requirementsFake, result } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    requirementsFake.api.setDocument.mockRejectedValueOnce(
      new DataError('conflict', { cause: { code: '23503' } }),
    );
    result.current.value.link(item, document.id);
    await waitFor(() =>
      expect(result.current.value.error).toBe(
        'That document was deleted in another tab. Reload the page and try again.',
      ),
    );
  });

  it('says so when the checklist item was deleted in the meantime', async () => {
    const [document, item] = [fakeDocument(), fakeRequirement()];
    const { requirementsFake, result } = await setup(useDocumentLinks, {
      documents: [document],
      requirements: [item],
    });
    requirementsFake.api.setDocument.mockRejectedValueOnce(new DataError('not_found'));
    result.current.value.link(item, document.id);
    await waitFor(() =>
      expect(result.current.value.error).toMatch(/That checklist item no longer exists/),
    );
  });
});

describe('useApplicationDocumentItems', () => {
  it('gives one program’s items that can use a document, in checklist order', async () => {
    const requirements = [
      fakeRequirement({ id: 'theirs', application_id: 'other', kind: 'transcript' }),
      fakeRequirement({ id: 'letter', application_id: 'mine', kind: 'recommendation_letter' }),
      fakeRequirement({ id: 'fee', application_id: 'mine', kind: 'application_fee' }),
      fakeRequirement({ id: 'transcript', application_id: 'mine', kind: 'transcript' }),
      fakeRequirement({ id: 'resume', application_id: 'mine', kind: 'resume_cv' }),
    ];
    const { result } = await setup(() => useApplicationDocumentItems('mine'), { requirements });
    expect(result.current.value.data?.map((row) => row.id)).toEqual(['resume', 'transcript']);
  });
});

describe('useDocumentUsage', () => {
  const requirements = () => [
    fakeRequirement({ document_id: 'a' }),
    fakeRequirement({ document_id: 'a' }),
    fakeRequirement({ document_id: 'b' }),
    fakeRequirement({ document_id: null }),
  ];

  /** Only the checklist is needed, and it is not in the cache: it has to be asked for. */
  function setupUsage(before: (fake: ReturnType<typeof createFakeRequirementsApi>) => void) {
    const fake = createFakeRequirementsApi(requirements());
    before(fake);
    const queryClient = createQueryClient({ retry: false });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider client={createFakeAuth(fakeSession()).client}>
        <RequirementsApiContext value={fake.api}>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </RequirementsApiContext>
      </AuthProvider>
    );
    return { fake, ...renderHook(() => useDocumentUsage(), { wrapper }) };
  }

  it('is loading, with nothing in it, then ready with the counts', async () => {
    const seed = requirements();
    let release = () => {};
    const { fake, result } = setupUsage((fake) =>
      fake.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(structuredClone(seed));
          }),
      ),
    );
    // Signing in comes first; the checklist is only asked for after that.
    await waitFor(() => expect(fake.api.list).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe('loading');
    expect(result.current.byDocument.size).toBe(0);

    act(() => release());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // Two items use "a", one uses "b", and an item with no document counts for nothing.
    expect(result.current.byDocument.get('a')).toBe(2);
    expect(result.current.byDocument.get('b')).toBe(1);
    expect(result.current.byDocument.size).toBe(2);
  });

  it('is unavailable when the checklist cannot be loaded, and can try again', async () => {
    const { result } = setupUsage((fake) =>
      fake.api.list.mockRejectedValueOnce(new DataError('network')),
    );
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.byDocument.size).toBe(0);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.byDocument.get('a')).toBe(2);
  });

  it('is ready with nothing in it when no checklist item uses a document', async () => {
    const { result } = setupUsage((fake) => fake.api.list.mockResolvedValueOnce([]));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.byDocument.size).toBe(0);
  });
});

describe('error messages', () => {
  it('describe a failed document request', () => {
    expect(documentErrorMessage(new DataError('network'))).toMatch(/Can't reach the server/);
    expect(documentErrorMessage(new DataError('not_found'))).toMatch(
      /That document no longer exists/,
    );
    expect(documentErrorMessage(new Error('boom'))).toEqual(expect.any(String));
  });

  it('describe a failed choice of document for a checklist item', () => {
    expect(linkErrorMessage(new DataError('unknown', { cause: { code: '23503' } }))).toBe(
      'That document was deleted in another tab. Reload the page and try again.',
    );
    expect(linkErrorMessage(new DataError('network'))).toMatch(/Can't reach the server/);
    expect(linkErrorMessage(new DataError('not_found'))).toMatch(
      /That checklist item no longer exists/,
    );
  });
});
