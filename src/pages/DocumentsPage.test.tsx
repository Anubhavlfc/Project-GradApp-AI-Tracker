import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { DocumentRow } from '@/features/documents/types';
import type { RequirementRow } from '@/features/requirements/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeDocumentsApi, fakeDocument } from '@/test/fakeDocumentsApi';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { renderApp } from '@/test/renderApp';

type Doc = Partial<DocumentRow> & { name: string };
type Item = Partial<RequirementRow> & { id: string };

function open({ documents = [], items = [] }: { documents?: Doc[]; items?: Item[] } = {}) {
  const applications = createFakeApplicationsApi([fakeRecord({ id: 'stanford' })]);
  const requirements = createFakeRequirementsApi(
    items.map((item) => fakeRequirement({ application_id: 'stanford', ...item })),
  );
  const library = createFakeDocumentsApi(
    documents.map((document) => fakeDocument({ id: document.name, ...document })),
  );
  const view = renderApp('/app/documents', createFakeAuth(fakeSession()).client, {
    api: applications.api,
    requirementsApi: requirements.api,
    documentsApi: library.api,
  });
  return { ...view, requirements, library };
}

const ready = () => screen.findByRole('list', { name: 'Documents' });
const list = () => screen.getByRole('list', { name: 'Documents' });
const names = () =>
  within(list())
    .getAllByRole('button', { name: /^Actions for / })
    .map((button) => button.getAttribute('aria-label')!.slice('Actions for '.length));
const rowFor = (name: string) =>
  within(list())
    .getByRole('button', { name: `Actions for ${name}` })
    .closest('li') as HTMLElement;
const statusButton = (name: string) =>
  within(rowFor(name)).getByRole('button', {
    name: (label) => label.endsWith(`. Change status of ${name}`),
  });
const statusOf = (name: string) => statusButton(name).getAttribute('aria-label')!.split('.')[0];

function changeStatus(name: string, status: string) {
  fireEvent.click(statusButton(name));
  fireEvent.click(screen.getByRole('menuitemradio', { name: status }));
}
function chooseAction(name: string, action: 'Edit document' | 'Delete document…') {
  fireEvent.click(within(rowFor(name)).getByRole('button', { name: `Actions for ${name}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

async function openAddForm() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add document' }))[0]!);
  return screen.findByRole('dialog', { name: 'Add document' });
}

describe('the documents page', () => {
  describe('getting there', () => {
    it('is in the sidebar, after applications', async () => {
      open();
      await screen.findByRole('heading', { level: 1, name: 'Documents' });
      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      const link = within(nav).getByRole('link', { name: 'Documents' });
      expect(link).toHaveAttribute('href', '/app/documents');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('shows that it is loading, then the documents', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      let release = () => {};
      library.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(library.rows);
          }),
      );
      expect(await screen.findByText('Loading documents')).toBeInTheDocument();
      release();
      await ready();
      expect(names()).toEqual(['Resume']);
    });
  });

  describe('with no documents', () => {
    it('offers the usual ones or your own, and has no other add button', async () => {
      open();
      expect(await screen.findByRole('heading', { name: 'No documents yet.' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add the usual documents' })).toBeEnabled();
      expect(screen.getAllByRole('button', { name: 'Add a document' })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Add document' })).toBeNull();
      expect(screen.queryByText('Documents at a glance')).toBeNull();
    });

    it('opens the form for one document of your own', async () => {
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Add a document' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add document' });
      expect(field(dialog, /^Type/)).toHaveValue('resume');
      expect(field(dialog, 'Status')).toHaveValue('not_started');
    });
  });

  describe('the documents', () => {
    it('lists them by type and then name, showing the type, link and notes', async () => {
      open({
        documents: [
          { name: 'Transcript', kind: 'transcript' },
          { name: 'Draft 10', kind: 'statement_of_purpose' },
          {
            name: 'Resume, 2026',
            kind: 'resume',
            url: 'https://www.dropbox.com/s/abc/resume.pdf',
            notes: 'Two pages',
          },
          { name: 'Draft 2', kind: 'statement_of_purpose' },
        ],
      });
      await ready();
      expect(names()).toEqual(['Resume, 2026', 'Draft 2', 'Draft 10', 'Transcript']);
      const row = rowFor('Resume, 2026');
      expect(within(row).getByText('Resume')).toBeInTheDocument();
      expect(within(row).getByText('Two pages')).toBeInTheDocument();
      const link = within(row).getByRole('link', { name: /dropbox\.com/ });
      expect(link).toHaveAttribute('href', 'https://www.dropbox.com/s/abc/resume.pdf');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('says how many checklist items use each document', async () => {
      open({
        documents: [
          { name: 'Resume', kind: 'resume' },
          { name: 'Transcript', kind: 'transcript' },
          { name: 'Portfolio', kind: 'portfolio' },
        ],
        items: [
          { id: 'a', kind: 'resume_cv', document_id: 'Resume' },
          { id: 'b', kind: 'resume_cv', document_id: 'Resume' },
          { id: 'c', kind: 'transcript', document_id: 'Transcript' },
        ],
      });
      await ready();
      await waitFor(() =>
        expect(within(rowFor('Resume')).getByText(/Used for 2 checklist items/)).toBeVisible(),
      );
      expect(within(rowFor('Transcript')).getByText(/Used for 1 checklist item$/)).toBeVisible();
      expect(within(rowFor('Portfolio')).queryByText(/Used for/)).toBeNull();
    });

    it('shows how far along they are as a whole', async () => {
      open({
        documents: [
          { name: 'A', status: 'complete' },
          { name: 'B', status: 'in_progress' },
          { name: 'C', status: 'not_started' },
          { name: 'D', status: 'not_started' },
        ],
      });
      await ready();
      const card = screen.getByText('Documents at a glance').closest('div.rounded-lg')!;
      expect(within(card as HTMLElement).getByText('1 of 4')).toBeInTheDocument();
      expect(within(card as HTMLElement).getByText('25%')).toBeInTheDocument();
      expect(
        within(card as HTMLElement).getByText('1 in progress · 2 not started'),
      ).toBeInTheDocument();
      expect(
        within(card as HTMLElement).getByRole('progressbar', { name: 'Documents completed' }),
      ).toHaveAttribute('aria-valuenow', '25');
    });

    it('celebrates quietly when every document is complete', async () => {
      open({
        documents: [
          { name: 'A', status: 'complete' },
          { name: 'B', status: 'complete' },
        ],
      });
      await ready();
      expect(screen.getByText('Every document is complete.')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('changing a status', () => {
    it('saves it and updates the total', async () => {
      const { library } = open({
        documents: [
          { name: 'Resume', status: 'in_progress' },
          { name: 'CV', status: 'not_started' },
        ],
      });
      await ready();
      changeStatus('Resume', 'Complete');
      await waitFor(() => expect(statusOf('Resume')).toBe('Complete'));
      expect(library.api.setStatus).toHaveBeenCalledWith('Resume', 'complete');
      expect(await screen.findByText('50%')).toBeInTheDocument();
      expect(statusOf('CV')).toBe('Not Started');
    });

    it('puts the old status back and says why when it cannot be saved', async () => {
      const { library } = open({ documents: [{ name: 'Resume', status: 'in_progress' }] });
      await ready();
      library.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Resume', 'Complete');
      expect(await screen.findByText("Couldn't update that document")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      await waitFor(() => expect(statusOf('Resume')).toBe('In Progress'));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("Couldn't update that document")).toBeNull();
    });
  });

  describe('adding a document', () => {
    it('saves it, says so, and lists it', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, '  Personal   statement v1 ');
      setField(dialog, /^Type/, 'personal_statement');
      setField(dialog, 'Status', 'in_progress');
      setField(dialog, 'Link', 'docs.google.com/document/d/abc');
      setField(dialog, 'Notes', 'Needs a stronger ending');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add document' }));
      expect(await screen.findByText('Added Personal statement v1.')).toBeInTheDocument();
      await gone('Add document');
      expect(library.api.create).toHaveBeenCalledWith({
        name: 'Personal statement v1',
        kind: 'personal_statement',
        status: 'in_progress',
        url: 'https://docs.google.com/document/d/abc',
        notes: 'Needs a stronger ending',
      });
      expect(names()).toEqual(['Resume', 'Personal statement v1']);
      expect(statusOf('Personal statement v1')).toBe('In Progress');
    });

    it('never sends who owns it', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'CV');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add document' }));
      await waitFor(() => expect(library.api.create).toHaveBeenCalled());
      expect(library.api.create.mock.calls[0]![0]).not.toHaveProperty('user_id');
    });

    it('asks for a name, and does not save without one', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      const dialog = await openAddForm();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add document' }));
      expect(await within(dialog).findByText('Enter a name, like "Resume, 2026".')).toBeVisible();
      expect(library.api.create).not.toHaveBeenCalled();
      expect(field(dialog, /^Name/)).toHaveFocus();
    });

    it('refuses a link that is not a website', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'CV');
      setField(dialog, 'Link', 'javascript:alert(1)');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add document' }));
      expect(await within(dialog).findByText(/web address/i)).toBeVisible();
      expect(library.api.create).not.toHaveBeenCalled();
    });

    it('keeps the form open, with what was typed, when the server refuses', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      library.api.create.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'CV');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add document' }));
      expect(await within(dialog).findByText('Failed to save document')).toBeVisible();
      expect(within(dialog).getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(field(dialog, /^Name/)).toHaveValue('CV');
      expect(names()).toEqual(['Resume']);
    });

    it('starts each time from an empty form', async () => {
      open({ documents: [{ name: 'Resume' }] });
      await ready();
      let dialog = await openAddForm();
      setField(dialog, /^Name/, 'Half typed');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Add document');
      dialog = await openAddForm();
      expect(field(dialog, /^Name/)).toHaveValue('');
    });
  });

  describe('editing a document', () => {
    it('fills the form with what is saved, and saves changes', async () => {
      const { library } = open({
        documents: [
          { name: 'Resume', kind: 'resume', url: 'https://example.com/r.pdf', notes: 'v1' },
        ],
      });
      await ready();
      chooseAction('Resume', 'Edit document');
      const dialog = await screen.findByRole('dialog', { name: 'Edit document' });
      expect(field(dialog, /^Name/)).toHaveValue('Resume');
      expect(field(dialog, 'Link')).toHaveValue('https://example.com/r.pdf');
      expect(field(dialog, 'Notes')).toHaveValue('v1');
      setField(dialog, /^Name/, 'Resume, final');
      setField(dialog, 'Link', '');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved Resume, final.')).toBeInTheDocument();
      expect(library.api.update).toHaveBeenCalledWith(
        'Resume',
        expect.objectContaining({ name: 'Resume, final', url: null, notes: 'v1' }),
      );
      expect(names()).toEqual(['Resume, final']);
    });

    it('does not save when cancelled', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      chooseAction('Resume', 'Edit document');
      const dialog = await screen.findByRole('dialog', { name: 'Edit document' });
      setField(dialog, /^Name/, 'Changed');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Edit document');
      expect(library.api.update).not.toHaveBeenCalled();
      expect(names()).toEqual(['Resume']);
    });
  });

  describe('deleting a document', () => {
    it('asks first, then removes it', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }, { name: 'CV', kind: 'cv' }] });
      await ready();
      chooseAction('Resume', 'Delete document…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this document?' });
      expect(dialog).toHaveTextContent('“Resume” will be removed from your documents.');
      expect(library.api.remove).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete document' }));
      expect(await screen.findByText('Deleted Resume.')).toBeInTheDocument();
      expect(library.api.remove).toHaveBeenCalledWith('Resume');
      expect(names()).toEqual(['CV']);
    });

    it('says which checklist items use it, and that they stay', async () => {
      open({
        documents: [{ name: 'Resume' }],
        items: [
          { id: 'a', kind: 'resume_cv', document_id: 'Resume' },
          { id: 'b', kind: 'resume_cv', document_id: 'Resume' },
        ],
      });
      await ready();
      await screen.findByText(/Used for 2 checklist items/);
      chooseAction('Resume', 'Delete document…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this document?' });
      expect(dialog).toHaveTextContent(
        '2 checklist items use it; they stay on their list, without a document.',
      );
    });

    it('does not remove it when you change your mind', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      chooseAction('Resume', 'Delete document…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this document?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this document?');
      expect(library.api.remove).not.toHaveBeenCalled();
      expect(names()).toEqual(['Resume']);
    });

    it('keeps it, and says why, when the server refuses', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      await ready();
      library.api.remove.mockRejectedValueOnce(new DataError('network'));
      chooseAction('Resume', 'Delete document…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this document?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete document' }));
      expect(await within(dialog).findByText("Couldn't delete this document")).toBeVisible();
      expect(names()).toEqual(['Resume']);
    });
  });

  describe('adding the usual documents', () => {
    async function openUsual() {
      fireEvent.click(await screen.findByRole('button', { name: 'Add the usual documents' }));
      return screen.findByRole('dialog', { name: 'Add the usual documents' });
    }

    it('starts with a resume, a statement of purpose and a transcript ticked', async () => {
      open();
      const dialog = await openUsual();
      const ticked = within(dialog)
        .getAllByRole('checkbox')
        .filter((box) => (box as HTMLInputElement).checked)
        .map((box) => box.getAttribute('aria-label') ?? box.closest('div')!.textContent);
      expect(ticked).toHaveLength(3);
      expect(within(dialog).getByRole('button', { name: 'Add 3 documents' })).toBeEnabled();
      expect(within(dialog).getByLabelText('Resume')).toBeChecked();
      expect(within(dialog).getByLabelText('Statement of Purpose')).toBeChecked();
      expect(within(dialog).getByLabelText('Transcript')).toBeChecked();
      expect(within(dialog).getByLabelText('CV')).not.toBeChecked();
    });

    it('adds what is ticked in one request', async () => {
      const { library } = open();
      const dialog = await openUsual();
      fireEvent.click(within(dialog).getByLabelText('Transcript'));
      fireEvent.click(within(dialog).getByLabelText('Portfolio'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 3 documents' }));
      expect(await screen.findByText('Added 3 documents.')).toBeInTheDocument();
      expect(library.api.createMany).toHaveBeenCalledTimes(1);
      expect(library.api.createMany.mock.calls[0]![0].map((item) => item.name)).toEqual([
        'Resume',
        'Statement of Purpose',
        'Portfolio',
      ]);
      expect(names()).toEqual(['Resume', 'Statement of Purpose', 'Portfolio']);
    });

    it('does not offer a type that is already on your list', async () => {
      open({ documents: [{ name: 'My resume', kind: 'resume' }] });
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Add the usual documents' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add the usual documents' });
      const resume = within(dialog).getByLabelText('Resume');
      expect(resume).toBeDisabled();
      expect(resume).not.toBeChecked();
      expect(within(dialog).getByText('Already on your list')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Add 2 documents' })).toBeEnabled();
    });

    it('adds only the types that are not on your list yet', async () => {
      const { library } = open({ documents: [{ name: 'My resume', kind: 'resume' }] });
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Add the usual documents' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add the usual documents' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 2 documents' }));
      expect(await screen.findByText('Added 2 documents.')).toBeInTheDocument();
      expect(library.api.createMany.mock.calls[0]![0].map((item) => item.name)).toEqual([
        'Statement of Purpose',
        'Transcript',
      ]);
      expect(library.rows.filter((row) => row.kind === 'resume')).toHaveLength(1);
    });

    it('cannot add nothing', async () => {
      open();
      const dialog = await openUsual();
      for (const name of ['Resume', 'Statement of Purpose', 'Transcript']) {
        fireEvent.click(within(dialog).getByLabelText(name));
      }
      expect(within(dialog).getByRole('button', { name: 'Add documents' })).toBeDisabled();
    });

    it('says so, and keeps the choices, when the server refuses', async () => {
      const { library } = open();
      library.api.createMany.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openUsual();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 3 documents' }));
      expect(await within(dialog).findByText('Failed to add documents')).toBeVisible();
      expect(within(dialog).getByLabelText('Resume')).toBeChecked();
      expect(library.rows).toHaveLength(0);
    });

    it('is not offered in the header once every usual type is on the list', async () => {
      open({
        documents: [
          { name: 'a', kind: 'resume' },
          { name: 'b', kind: 'cv' },
          { name: 'c', kind: 'statement_of_purpose' },
          { name: 'd', kind: 'personal_statement' },
          { name: 'e', kind: 'transcript' },
          { name: 'f', kind: 'writing_sample' },
          { name: 'g', kind: 'portfolio' },
          { name: 'h', kind: 'gre_score' },
          { name: 'i', kind: 'toefl_score' },
          { name: 'j', kind: 'ielts_score' },
        ],
      });
      await ready();
      expect(screen.queryByRole('button', { name: 'Add the usual documents' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Add document' })).toBeEnabled();
    });
  });

  describe('when the server is not reachable', () => {
    it('says the documents could not be loaded, and tries again on request', async () => {
      const { library } = open({ documents: [{ name: 'Resume' }] });
      library.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load documents')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: 'No documents yet.' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Resume']);
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { library } = open({ documents: [{ name: 'Resume', status: 'in_progress' }] });
      await ready();
      library.api.list.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Resume', 'Complete');
      expect(await screen.findByText('Unable to refresh documents')).toBeInTheDocument();
      expect(names()).toEqual(['Resume']);
      expect(screen.getByText(/Showing the last list that loaded\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh documents')).not.toBeInTheDocument(),
      );
    });

    it('lists the documents, and says so, when it cannot tell where they are used', async () => {
      const { requirements } = open({ documents: [{ name: 'Resume' }] });
      requirements.api.list.mockRejectedValueOnce(new DataError('network'));
      await ready();
      expect(await screen.findByText("Can't tell where your documents are used")).toBeVisible();
      expect(names()).toEqual(['Resume']);
      expect(within(rowFor('Resume')).queryByText(/Used for/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText("Can't tell where your documents are used")).toBeNull(),
      );
    });

    it('does not claim a document is used nowhere while that is unknown', async () => {
      const { requirements } = open({
        documents: [{ name: 'Resume' }],
        items: [{ id: 'a', kind: 'resume_cv', document_id: 'Resume' }],
      });
      requirements.api.list.mockRejectedValueOnce(new DataError('network'));
      await ready();
      await screen.findByText("Can't tell where your documents are used");
      chooseAction('Resume', 'Delete document…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this document?' });
      expect(dialog).toHaveTextContent(
        'Checklist items that use it stay on their lists, without a document.',
      );
    });
  });
});
