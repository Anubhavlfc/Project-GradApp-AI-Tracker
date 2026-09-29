import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { DocumentRow } from '@/features/documents/types';
import type { RequirementRow } from '@/features/requirements/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeDocumentsApi, fakeDocument } from '@/test/fakeDocumentsApi';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { renderApp } from '@/test/renderApp';

const stanford = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    status: 'documents_in_progress',
    university: { name: 'Stanford University' },
    ...overrides,
  });

type Item = Partial<RequirementRow> & { id: string };
type Doc = Partial<DocumentRow> & { name: string };

/** Opens one program's Documents tab, with these checklist items (on this program) and documents. */
function open({
  items = [],
  documents = [],
  record = stanford(),
  path = 'documents',
}: {
  items?: Item[];
  documents?: Doc[];
  record?: ReturnType<typeof stanford>;
  path?: string;
} = {}) {
  const applications = createFakeApplicationsApi([record]);
  const requirements = createFakeRequirementsApi(
    items.map((item) => fakeRequirement({ application_id: record.id, ...item })),
  );
  const library = createFakeDocumentsApi(
    documents.map((document) => fakeDocument({ id: document.name, ...document })),
  );
  const view = renderApp(
    `/app/applications/${record.id}/${path}`,
    createFakeAuth(fakeSession()).client,
    { api: applications.api, requirementsApi: requirements.api, documentsApi: library.api },
  );
  return { ...view, record, applications, requirements, library };
}

const list = () => screen.getByRole('list', { name: 'Documents for this program' });
const ready = () => screen.findByRole('list', { name: 'Documents for this program' });
/** The items on the list, top to bottom. */
const titles = () =>
  within(list())
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')!.textContent);
const selectFor = (title: string) =>
  within(list()).getByRole('combobox', { name: `Document for ${title}` }) as HTMLSelectElement;
const rowFor = (title: string) => selectFor(title).closest('li') as HTMLElement;
const choose = (title: string, name: string) =>
  fireEvent.change(selectFor(title), {
    target: {
      value:
        name === ''
          ? ''
          : (within(selectFor(title)).getByRole('option', { name }) as HTMLOptionElement).value,
    },
  });
const chosenName = (title: string) => {
  const select = selectFor(title);
  return select.selectedOptions[0]?.textContent;
};
const optionsOf = (title: string) =>
  within(selectFor(title))
    .getAllByRole('option')
    .map((option) => option.textContent);
const groupsOf = (title: string) =>
  Array.from(selectFor(title).querySelectorAll('optgroup'), (group) => ({
    label: group.label,
    options: Array.from(group.querySelectorAll('option'), (option) => option.textContent),
  }));

describe('a program’s documents tab', () => {
  describe('getting there', () => {
    it('is a tab on the program page, between requirements and recommendations', async () => {
      const { record } = open({ path: '' });
      const tabs = await screen.findByRole('navigation', { name: 'Sections of this program' });
      expect(
        within(tabs)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual([
        'Overview',
        'Requirements',
        'Documents',
        'Recommendations',
        'Funding',
        'Tasks',
        'Notes',
      ]);
      fireEvent.click(within(tabs).getByRole('link', { name: 'Documents' }));
      expect(
        await screen.findByRole('heading', { name: 'No document items on this checklist yet.' }),
      ).toBeVisible();
      expect(within(tabs).getByRole('link', { name: 'Documents' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Documents' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/documents`,
      );
    });

    it('shows that it is loading, then the items', async () => {
      const { requirements } = open({ items: [{ id: 'r1', kind: 'transcript' }] });
      let release = () => {};
      requirements.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(requirements.rows);
          }),
      );
      expect(await screen.findByText('Loading documents')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Documents for this program' })).toBeNull();
      release();
      await ready();
      expect(titles()).toEqual(['Transcript']);
    });
  });

  describe('when the checklist has nothing a document can be used for', () => {
    it('sends you to the requirements to add some', async () => {
      const { record } = open();
      expect(
        await screen.findByRole('heading', { name: 'No document items on this checklist yet.' }),
      ).toBeVisible();
      expect(screen.getByRole('link', { name: 'Go to requirements' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/requirements`,
      );
    });

    it('sends you there even when you already have documents, because the items are what is missing', async () => {
      open({ documents: [{ name: 'Resume, 2026', kind: 'resume' }] });
      expect(
        await screen.findByRole('heading', { name: 'No document items on this checklist yet.' }),
      ).toBeVisible();
      expect(screen.queryByRole('list', { name: 'Documents for this program' })).toBeNull();
      expect(screen.queryByText("You haven't added any documents yet.")).toBeNull();
    });

    it('does not count recommendation letters or the application fee as document items', async () => {
      open({
        items: [
          { id: 'l', kind: 'recommendation_letter', label: 'Recommendation Letter 1' },
          { id: 'f', kind: 'application_fee' },
        ],
      });
      expect(
        await screen.findByRole('heading', { name: 'No document items on this checklist yet.' }),
      ).toBeVisible();
    });
  });

  describe('the items', () => {
    it('lists the items that need a document, in checklist order, with their status', async () => {
      open({
        items: [
          { id: 'a', kind: 'transcript', status: 'complete' },
          { id: 'b', kind: 'recommendation_letter', label: 'Recommendation Letter 1' },
          { id: 'c', kind: 'resume_cv', status: 'in_progress' },
          { id: 'd', kind: 'statement_of_purpose', label: 'Why Stanford' },
        ],
      });
      await ready();
      expect(titles()).toEqual(['Resume / CV', 'Why Stanford', 'Transcript']);
      expect(within(rowFor('Transcript')).getByText('Complete')).toBeInTheDocument();
      expect(within(rowFor('Resume / CV')).getByText('In Progress')).toBeInTheDocument();
      expect(within(rowFor('Why Stanford')).getByText('Statement of Purpose')).toBeInTheDocument();
    });

    it('shows only this program’s items', async () => {
      const record = stanford();
      const { requirements } = open({ record, items: [{ id: 'mine', kind: 'transcript' }] });
      requirements.rows.push(
        fakeRequirement({ id: 'theirs', application_id: 'another-program', kind: 'portfolio' }),
      );
      await ready();
      expect(titles()).toEqual(['Transcript']);
    });

    it('does not offer to change an item’s status here', async () => {
      open({ items: [{ id: 'a', kind: 'transcript' }] });
      await ready();
      expect(within(list()).queryByRole('button', { name: /Change status/ })).toBeNull();
    });
  });

  describe('choosing a document', () => {
    const documents: Doc[] = [
      { name: 'Statement v3', kind: 'statement_of_purpose' },
      { name: 'Resume, 2026', kind: 'resume' },
      { name: 'Academic CV', kind: 'cv' },
      { name: 'Official transcript', kind: 'transcript' },
    ];

    it('starts with no document chosen', async () => {
      open({ items: [{ id: 'a', kind: 'transcript' }], documents });
      await ready();
      expect(chosenName('Transcript')).toBe('No document chosen');
    });

    it('offers the documents that suit the item first, the best fit at the top', async () => {
      open({ items: [{ id: 'a', kind: 'resume_cv' }], documents });
      await ready();
      expect(optionsOf('Resume / CV')[0]).toBe('No document chosen');
      expect(groupsOf('Resume / CV')).toEqual([
        { label: 'Suggested', options: ['Resume, 2026', 'Academic CV'] },
        { label: 'Other documents', options: ['Statement v3', 'Official transcript'] },
      ]);
    });

    it('still offers every document for an item nothing is suggested for', async () => {
      open({ items: [{ id: 'a', kind: 'other', label: 'Extra form' }], documents });
      await ready();
      expect(groupsOf('Extra form')).toEqual([
        {
          label: 'Your documents',
          options: ['Resume, 2026', 'Academic CV', 'Statement v3', 'Official transcript'],
        },
      ]);
    });

    it('saves the choice for that item only', async () => {
      const { requirements } = open({
        items: [
          { id: 'a', kind: 'transcript' },
          { id: 'b', kind: 'resume_cv' },
        ],
        documents,
      });
      await ready();
      choose('Transcript', 'Official transcript');
      await waitFor(() =>
        expect(requirements.api.setDocument).toHaveBeenCalledWith('a', 'Official transcript'),
      );
      expect(requirements.api.setDocument).toHaveBeenCalledTimes(1);
      expect(chosenName('Transcript')).toBe('Official transcript');
      expect(chosenName('Resume / CV')).toBe('No document chosen');
      expect(requirements.rows.find((row) => row.id === 'a')?.document_id).toBe(
        'Official transcript',
      );
      expect(requirements.rows.find((row) => row.id === 'b')?.document_id).toBeNull();
    });

    it('can take the document away again', async () => {
      const { requirements } = open({
        items: [{ id: 'a', kind: 'transcript', document_id: 'Official transcript' }],
        documents,
      });
      await ready();
      expect(chosenName('Transcript')).toBe('Official transcript');
      choose('Transcript', 'No document chosen');
      await waitFor(() => expect(requirements.api.setDocument).toHaveBeenCalledWith('a', null));
      await waitFor(() => expect(chosenName('Transcript')).toBe('No document chosen'));
    });

    it('does not change anything else about the item', async () => {
      const { requirements } = open({
        items: [{ id: 'a', kind: 'transcript', status: 'submitted', notes: 'Sent by post' }],
        documents,
      });
      await ready();
      choose('Transcript', 'Official transcript');
      await waitFor(() => expect(requirements.api.setDocument).toHaveBeenCalled());
      expect(requirements.rows[0]).toMatchObject({ status: 'submitted', notes: 'Sent by post' });
      expect(requirements.api.update).not.toHaveBeenCalled();
    });

    it('shows how far along the chosen document is, and where it lives', async () => {
      open({
        items: [{ id: 'a', kind: 'resume_cv', document_id: 'Resume, 2026' }],
        documents: [
          {
            name: 'Resume, 2026',
            kind: 'resume',
            status: 'in_progress',
            url: 'https://www.dropbox.com/s/abc/resume.pdf',
          },
        ],
      });
      await ready();
      const row = rowFor('Resume / CV');
      expect(within(row).getByText('In Progress')).toBeInTheDocument();
      const link = within(row).getByRole('link', { name: /dropbox\.com/ });
      expect(link).toHaveAttribute('href', 'https://www.dropbox.com/s/abc/resume.pdf');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('shows nothing about a document when none is chosen', async () => {
      open({ items: [{ id: 'a', kind: 'resume_cv' }], documents });
      await ready();
      const row = rowFor('Resume / CV');
      expect(within(row).queryByRole('link')).toBeNull();
      expect(within(row).queryByText('Complete')).toBeNull();
    });
  });

  describe('when there are no documents yet', () => {
    it('says so and offers to add one, while the items wait', async () => {
      open({ items: [{ id: 'a', kind: 'transcript' }] });
      await ready();
      expect(screen.getByText("You haven't added any documents yet.")).toBeInTheDocument();
      expect(optionsOf('Transcript')).toEqual(['No document chosen']);
      expect(screen.getByRole('button', { name: 'Add a document' })).toBeEnabled();
    });

    it('goes away once a document is added from here', async () => {
      const { library } = open({ items: [{ id: 'a', kind: 'transcript' }] });
      await ready();
      fireEvent.click(screen.getAllByRole('button', { name: 'Add document' })[0]!);
      const dialog = await screen.findByRole('dialog', { name: 'Add document' });
      fireEvent.change(within(dialog).getByLabelText(/^Name/), {
        target: { value: 'Official transcript' },
      });
      fireEvent.change(within(dialog).getByLabelText(/^Type/), { target: { value: 'transcript' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add document' }));
      expect(await screen.findByText('Added Official transcript.')).toBeInTheDocument();
      expect(library.rows.map((row) => row.name)).toEqual(['Official transcript']);
      expect(screen.queryByText("You haven't added any documents yet.")).toBeNull();
      // It is offered for the item, but not chosen for it.
      expect(optionsOf('Transcript')).toEqual(['No document chosen', 'Official transcript']);
      expect(chosenName('Transcript')).toBe('No document chosen');
    });
  });

  describe('the header', () => {
    it('links to all your documents', async () => {
      open({ items: [{ id: 'a', kind: 'transcript' }], documents: [{ name: 'Transcript' }] });
      await ready();
      expect(screen.getByRole('link', { name: 'All documents' })).toHaveAttribute(
        'href',
        '/app/documents',
      );
    });
  });

  describe('when the server is not reachable', () => {
    const documents: Doc[] = [{ name: 'Official transcript', kind: 'transcript' }];

    it('puts the choice back and says why when it cannot be saved', async () => {
      const { requirements } = open({
        items: [{ id: 'a', kind: 'transcript' }],
        documents,
      });
      await ready();
      requirements.api.setDocument.mockRejectedValueOnce(new DataError('network'));
      choose('Transcript', 'Official transcript');
      expect(await screen.findByText("Couldn't change that document")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      await waitFor(() => expect(chosenName('Transcript')).toBe('No document chosen'));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("Couldn't change that document")).toBeNull();
    });

    it('explains a document that was deleted in another tab', async () => {
      const { requirements } = open({ items: [{ id: 'a', kind: 'transcript' }], documents });
      await ready();
      requirements.api.setDocument.mockRejectedValueOnce(
        new DataError('conflict', { cause: { code: '23503' } }),
      );
      choose('Transcript', 'Official transcript');
      expect(
        await screen.findByText(
          'That document was deleted in another tab. Reload the page and try again.',
        ),
      ).toBeInTheDocument();
    });

    it('says the documents could not be loaded, and tries again on request', async () => {
      const { library } = open({ items: [{ id: 'a', kind: 'transcript' }], documents });
      library.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load documents')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: /No document items/ })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(titles()).toEqual(['Transcript']);
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { requirements } = open({ items: [{ id: 'a', kind: 'transcript' }], documents });
      await ready();
      requirements.api.list.mockRejectedValueOnce(new DataError('network'));
      choose('Transcript', 'Official transcript');
      expect(await screen.findByText('Unable to refresh documents')).toBeInTheDocument();
      expect(titles()).toEqual(['Transcript']);
      expect(screen.getByText(/Showing the last list that loaded\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh documents')).not.toBeInTheDocument(),
      );
    });
  });
});
