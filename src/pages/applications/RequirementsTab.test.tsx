import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DataError } from '@/features/applications/errors';
import type { RequirementRow } from '@/features/requirements/types';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
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

/** Opens the Requirements tab of one program whose checklist already holds `items`. */
function open(items: Partial<RequirementRow>[] = [], record = stanford(), path = 'requirements') {
  const applications = createFakeApplicationsApi([record]);
  const checklist = createFakeRequirementsApi(
    items.map((item) => fakeRequirement({ application_id: record.id, ...item })),
  );
  const view = renderApp(
    `/app/applications/${record.id}/${path}`,
    createFakeAuth(fakeSession()).client,
    { api: applications.api, requirementsApi: checklist.api },
  );
  return { ...view, record, applications, checklist };
}

const list = () => screen.getByRole('list', { name: 'Requirements' });
const ready = () => screen.findByRole('list', { name: 'Requirements' });
/** The names on the checklist, top to bottom. */
const titles = () =>
  within(list())
    .getAllByRole('button', { name: /^Actions for / })
    .map((button) => button.getAttribute('aria-label')!.slice('Actions for '.length));
const rowFor = (title: string) =>
  within(list())
    .getByRole('button', { name: `Actions for ${title}` })
    .closest('li') as HTMLElement;
/** The button that shows (and changes) an item's status. */
const statusButton = (title: string) =>
  within(rowFor(title)).getByRole('button', {
    name: (name) => name.endsWith(`. Change status of ${title}`),
  });
const statusOf = (title: string) => statusButton(title).getAttribute('aria-label')!.split('.')[0];

function changeStatus(title: string, status: string) {
  fireEvent.click(statusButton(title));
  fireEvent.click(screen.getByRole('menuitemradio', { name: status }));
}
function chooseAction(title: string, action: 'Edit' | 'Delete…') {
  fireEvent.click(within(rowFor(title)).getByRole('button', { name: `Actions for ${title}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

async function openAddForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add requirement' }));
  return screen.findByRole('dialog', { name: 'Add requirement' });
}
const submitAdd = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add requirement' }));

describe('a program’s requirements tab', () => {
  describe('getting there', () => {
    it('is a tab on the program page', async () => {
      const { record } = open([], stanford(), '');
      const tabs = await screen.findByRole('navigation', { name: 'Sections of this program' });
      expect(within(tabs).getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      fireEvent.click(within(tabs).getByRole('link', { name: 'Requirements' }));
      expect(await screen.findByRole('heading', { name: 'No requirements yet.' })).toBeVisible();
      expect(within(tabs).getByRole('link', { name: 'Requirements' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Requirements' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/requirements`,
      );
    });

    it('shows that it is loading, then the checklist', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      let release = () => {};
      checklist.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(checklist.rows);
          }),
      );
      expect(await screen.findByText('Loading requirements')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Requirements' })).not.toBeInTheDocument();
      release();
      await ready();
      expect(titles()).toEqual(['Transcript']);
    });
  });

  describe('an empty checklist', () => {
    it('invites you to add the first items', async () => {
      open();
      expect(await screen.findByRole('heading', { name: 'No requirements yet.' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add common requirements' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Add requirement' })).toBeEnabled();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  describe('the checklist', () => {
    it('lists the items in a steady order, whatever order they were added in', async () => {
      open([
        { kind: 'application_fee' },
        { kind: 'recommendation_letter', label: 'Recommendation Letter 10' },
        { kind: 'recommendation_letter', label: 'Recommendation Letter 2' },
        { kind: 'gre' },
        { kind: 'statement_of_purpose' },
        { kind: 'other', label: 'Video introduction' },
        { kind: 'resume_cv' },
      ]);
      await ready();
      expect(titles()).toEqual([
        'Resume / CV',
        'Statement of Purpose',
        'GRE',
        'Recommendation Letter 2',
        'Recommendation Letter 10',
        'Application Fee',
        'Video introduction',
      ]);
    });

    it('shows every item’s status, and its kind under a custom name', async () => {
      open([
        { kind: 'supplemental_essay', label: 'Why Stanford?', status: 'in_progress' },
        { kind: 'transcript', status: 'submitted' },
        { kind: 'gre', status: 'complete' },
        { kind: 'toefl' },
      ]);
      await ready();
      expect(statusOf('Why Stanford?')).toBe('In Progress');
      expect(statusOf('Transcript')).toBe('Submitted');
      expect(statusOf('GRE')).toBe('Complete');
      expect(statusOf('TOEFL')).toBe('Not Started');
      expect(within(rowFor('Why Stanford?')).getByText('Supplemental Essay')).toBeInTheDocument();
      // A kind is not repeated when the name already says it.
      expect(within(rowFor('Transcript')).queryByText('Transcript', { selector: 'p' })).toBeNull();
    });

    it('marks optional items and keeps notes and due dates with their item', async () => {
      open([
        { kind: 'portfolio', is_required: false, notes: 'Only if you have one.' },
        { kind: 'transcript', due_date: '2027-01-15' },
      ]);
      await ready();
      expect(within(rowFor('Portfolio')).getByText('Optional')).toBeInTheDocument();
      expect(within(rowFor('Portfolio')).getByText('Only if you have one.')).toBeInTheDocument();
      expect(within(rowFor('Transcript')).queryByText('Optional')).not.toBeInTheDocument();
      expect(within(rowFor('Transcript')).getByText('Jan 15, 2027')).toBeInTheDocument();
    });

    it('shows only this program’s items', async () => {
      open([{ kind: 'transcript' }, { kind: 'gre', application_id: 'some-other-program' }]);
      await ready();
      expect(titles()).toEqual(['Transcript']);
    });

    it('counts required items that are complete or submitted', async () => {
      open([
        { kind: 'resume_cv', status: 'complete' },
        { kind: 'transcript', status: 'submitted' },
        { kind: 'statement_of_purpose', status: 'in_progress' },
        { kind: 'gre' },
        { kind: 'portfolio', is_required: false, status: 'complete' },
      ]);
      await ready();
      expect(screen.getByText('2 of 4')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('1 in progress · 1 not started · 1 optional')).toBeInTheDocument();
      expect(
        screen.getByRole('progressbar', {
          name: 'Requirements completed for Stanford University, Computer Science',
        }),
      ).toHaveAttribute('aria-valuenow', '50');
    });

    it('says so when everything required is done', async () => {
      open([
        { kind: 'resume_cv', status: 'complete' },
        { kind: 'transcript', status: 'complete' },
      ]);
      await ready();
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('Every required item is done.')).toBeInTheDocument();
    });

    it('shows no progress while nothing is required', async () => {
      open([{ kind: 'portfolio', is_required: false }]);
      await ready();
      expect(screen.getByText(/No required items yet\./)).toBeInTheDocument();
      expect(screen.getByText(/Everything on this list is optional/)).toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    });

    it('announces the new total after a change', async () => {
      open([{ kind: 'resume_cv' }, { kind: 'transcript' }]);
      await ready();
      const announcement = screen.getByText('0 of 2 required items done.');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      changeStatus('Transcript', 'Complete');
      await waitFor(() => expect(announcement).toHaveTextContent('1 of 2 required items done.'));
    });
  });

  describe('due dates', () => {
    it('warns about open items that are late or close', async () => {
      open([
        { kind: 'resume_cv', due_date: daysFromNow(-3) },
        { kind: 'transcript', due_date: daysFromNow(0) },
        { kind: 'gre', due_date: daysFromNow(4) },
        { kind: 'toefl', due_date: daysFromNow(200) },
      ]);
      await ready();
      expect(within(rowFor('Resume / CV')).getByText('3 days overdue')).toBeInTheDocument();
      expect(within(rowFor('Transcript')).getByText('Due today')).toBeInTheDocument();
      expect(within(rowFor('GRE')).getByText('In 4 days')).toBeInTheDocument();
      // A date far away is shown, but not counted down.
      expect(within(rowFor('TOEFL')).getByText(/^Due/)).toBeInTheDocument();
      expect(within(rowFor('TOEFL')).queryByText(/days/)).not.toBeInTheDocument();
    });

    it('never calls a finished item late', async () => {
      open([
        { kind: 'resume_cv', due_date: daysFromNow(-3), status: 'complete' },
        { kind: 'transcript', due_date: daysFromNow(-3), status: 'submitted' },
      ]);
      await ready();
      expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
      expect(within(rowFor('Resume / CV')).getByText(/^Due/)).toBeInTheDocument();
    });

    it('never calls anything late once the application has been sent', async () => {
      open([{ kind: 'resume_cv', due_date: daysFromNow(-3) }], stanford({ status: 'submitted' }));
      await ready();
      expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
    });

    it('stops calling an item late when you finish it', async () => {
      open([{ kind: 'resume_cv', due_date: daysFromNow(-3) }]);
      await ready();
      expect(screen.getByText('3 days overdue')).toBeInTheDocument();
      changeStatus('Resume / CV', 'Complete');
      await waitFor(() => expect(screen.queryByText('3 days overdue')).not.toBeInTheDocument());
    });
  });

  describe('adding common requirements', () => {
    it('starts with the usual items ticked and adds them in one request', async () => {
      const { checklist, record } = open();
      fireEvent.click(await screen.findByRole('button', { name: 'Add common requirements' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add common requirements' });

      for (const name of [
        'Resume / CV',
        'Statement of Purpose',
        'Transcript',
        'Recommendation Letter 1',
        'Recommendation Letter 2',
        'Recommendation Letter 3',
        'Application Fee',
      ]) {
        expect(within(dialog).getByRole('checkbox', { name })).toBeChecked();
      }
      for (const name of ['Personal Statement', 'GRE', 'GMAT', 'TOEFL', 'IELTS', 'Portfolio']) {
        expect(within(dialog).getByRole('checkbox', { name })).not.toBeChecked();
      }

      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'GRE' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 8 requirements' }));

      expect(await screen.findByText('Added 8 requirements.')).toBeInTheDocument();
      await gone('Add common requirements');
      expect(checklist.api.add).toHaveBeenCalledTimes(1);
      const [applicationId, items] = checklist.api.add.mock.calls[0]!;
      expect(applicationId).toBe(record.id);
      expect(items).toHaveLength(8);
      expect(items).toContainEqual({
        kind: 'recommendation_letter',
        label: 'Recommendation Letter 2',
        is_required: true,
        status: 'not_started',
        due_date: null,
        notes: null,
      });
      expect(titles()).toEqual([
        'Resume / CV',
        'Statement of Purpose',
        'Transcript',
        'GRE',
        'Recommendation Letter 1',
        'Recommendation Letter 2',
        'Recommendation Letter 3',
        'Application Fee',
      ]);
      expect(screen.getByText('0 of 8')).toBeInTheDocument();
    });

    it('does not offer what is already on the list again', async () => {
      const { checklist } = open([
        { kind: 'transcript' },
        { kind: 'recommendation_letter', label: 'Recommendation Letter 1' },
      ]);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Add common requirements' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add common requirements' });
      for (const name of ['Transcript', 'Recommendation Letter 1']) {
        const box = within(dialog).getByRole('checkbox', { name });
        expect(box).toBeDisabled();
        expect(box).not.toBeChecked();
        expect(box).toHaveAccessibleDescription('Already on your list');
      }
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 5 requirements' }));
      await gone('Add common requirements');
      const items = checklist.api.add.mock.calls[0]![1];
      expect(items.map((item) => item.label ?? item.kind)).not.toContain('transcript');
      expect(items).toHaveLength(5);
    });

    it('counts what is ticked, and needs at least one', async () => {
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Add common requirements' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add common requirements' });
      const boxes = within(dialog).getAllByRole('checkbox');
      for (const box of boxes) if ((box as HTMLInputElement).checked) fireEvent.click(box);
      expect(within(dialog).getByRole('button', { name: 'Add 0 requirements' })).toBeDisabled();
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'IELTS' }));
      expect(within(dialog).getByRole('button', { name: 'Add 1 requirement' })).toBeEnabled();
    });

    it('starts over with the usual choices the next time it opens', async () => {
      open();
      fireEvent.click(await screen.findByRole('button', { name: 'Add common requirements' }));
      let dialog = await screen.findByRole('dialog', { name: 'Add common requirements' });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Transcript' }));
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'GRE' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Add common requirements');

      fireEvent.click(screen.getByRole('button', { name: 'Add common requirements' }));
      dialog = await screen.findByRole('dialog', { name: 'Add common requirements' });
      expect(within(dialog).getByRole('checkbox', { name: 'Transcript' })).toBeChecked();
      expect(within(dialog).getByRole('checkbox', { name: 'GRE' })).not.toBeChecked();
    });

    it('keeps the dialog open and explains when saving fails', async () => {
      const { checklist } = open();
      checklist.api.add.mockRejectedValueOnce(new DataError('network'));
      fireEvent.click(await screen.findByRole('button', { name: 'Add common requirements' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add common requirements' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 7 requirements' }));
      expect(await within(dialog).findByText('Failed to add requirements')).toBeInTheDocument();
      expect(dialog).toHaveTextContent("Can't reach the server");
      // Nothing was added, and trying again works.
      expect(checklist.rows).toHaveLength(0);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add 7 requirements' }));
      expect(await screen.findByText('Added 7 requirements.')).toBeInTheDocument();
      expect(checklist.rows).toHaveLength(7);
    });
  });

  describe('adding a requirement', () => {
    it('starts on the type, with sensible defaults', async () => {
      open([{ kind: 'transcript' }]);
      await ready();
      const dialog = await openAddForm();
      expect(field(dialog, /^Type/)).toHaveFocus();
      expect(field(dialog, /^Type/)).toHaveValue('resume_cv');
      expect(field(dialog, 'Status')).toHaveValue('not_started');
      expect(field(dialog, 'Required')).toBeChecked();
      expect(field(dialog, 'Name')).toHaveValue('');
      expect(field(dialog, 'Due date')).toHaveValue('');
    });

    it('saves what was entered', async () => {
      const { checklist, record } = open();
      const dialog = await openAddForm();
      setField(dialog, /^Type/, 'toefl');
      setField(dialog, 'Status', 'in_progress');
      setField(dialog, 'Due date', '2027-01-10');
      setField(dialog, 'Notes', 'Book the test date first.');
      submitAdd(dialog);

      expect(await screen.findByText('Added TOEFL.')).toBeInTheDocument();
      await gone('Add requirement');
      expect(checklist.api.add).toHaveBeenCalledWith(record.id, [
        {
          kind: 'toefl',
          label: null,
          is_required: true,
          status: 'in_progress',
          due_date: '2027-01-10',
          notes: 'Book the test date first.',
        },
      ]);
      expect(titles()).toEqual(['TOEFL']);
      expect(statusOf('TOEFL')).toBe('In Progress');
      expect(within(rowFor('TOEFL')).getByText('Jan 10, 2027')).toBeInTheDocument();
      expect(screen.getByText('0 of 1')).toBeInTheDocument();
    });

    it('can add an optional item that does not count towards progress', async () => {
      const { checklist } = open([{ kind: 'transcript', status: 'complete' }]);
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Type/, 'portfolio');
      fireEvent.click(field(dialog, 'Required'));
      submitAdd(dialog);
      expect(await screen.findByText('Added Portfolio.')).toBeInTheDocument();
      expect(checklist.api.add.mock.calls[0]![1][0]).toMatchObject({ is_required: false });
      expect(within(rowFor('Portfolio')).getByText('Optional')).toBeInTheDocument();
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
    });

    it('needs a name for "Other" and says so without saving', async () => {
      const { checklist } = open();
      const dialog = await openAddForm();
      setField(dialog, /^Type/, 'other');
      expect(field(dialog, /^Name/)).toHaveAttribute('aria-required', 'true');
      submitAdd(dialog);
      expect(await within(dialog).findByText('Give this requirement a name.')).toBeInTheDocument();
      expect(field(dialog, /^Name/)).toHaveAttribute('aria-invalid', 'true');
      expect(field(dialog, /^Name/)).toHaveFocus();
      expect(checklist.api.add).not.toHaveBeenCalled();

      setField(dialog, /^Name/, 'Video introduction');
      submitAdd(dialog);
      expect(await screen.findByText('Added Video introduction.')).toBeInTheDocument();
      expect(within(rowFor('Video introduction')).getByText('Other')).toBeInTheDocument();
    });

    it('suggests the next free number for a recommendation letter', async () => {
      open([
        { kind: 'recommendation_letter', label: 'Recommendation Letter 1' },
        { kind: 'recommendation_letter', label: 'Recommendation Letter 3' },
      ]);
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Type/, 'recommendation_letter');
      expect(field(dialog, 'Name')).toHaveValue('Recommendation Letter 2');
      // Switching to something else takes the suggestion back...
      setField(dialog, /^Type/, 'gre');
      expect(field(dialog, 'Name')).toHaveValue('');
      // ...but a name you typed yourself is never overwritten.
      setField(dialog, 'Name', 'Dr. Chen');
      setField(dialog, /^Type/, 'recommendation_letter');
      expect(field(dialog, 'Name')).toHaveValue('Dr. Chen');
    });

    it('lets you add two letters with the suggested names', async () => {
      const { checklist } = open();
      for (const expected of ['Recommendation Letter 1', 'Recommendation Letter 2']) {
        const dialog = await openAddForm();
        setField(dialog, /^Type/, 'recommendation_letter');
        expect(field(dialog, 'Name')).toHaveValue(expected);
        submitAdd(dialog);
        expect(await screen.findByText(`Added ${expected}.`)).toBeInTheDocument();
        await gone('Add requirement');
      }
      expect(checklist.rows.map((row) => row.label)).toEqual([
        'Recommendation Letter 1',
        'Recommendation Letter 2',
      ]);
    });

    it('opens empty every time', async () => {
      open();
      let dialog = await openAddForm();
      setField(dialog, /^Type/, 'gre');
      setField(dialog, 'Notes', 'left over?');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Add requirement');
      dialog = await openAddForm();
      expect(field(dialog, /^Type/)).toHaveValue('resume_cv');
      expect(field(dialog, 'Notes')).toHaveValue('');
    });

    it('keeps what you typed and explains when saving fails', async () => {
      const { checklist } = open();
      checklist.api.add.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openAddForm();
      setField(dialog, /^Type/, 'gre');
      setField(dialog, 'Notes', 'Test on the 12th');
      submitAdd(dialog);
      expect(await within(dialog).findByText('Failed to save requirement')).toBeInTheDocument();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(field(dialog, 'Notes')).toHaveValue('Test on the 12th');
      submitAdd(dialog);
      expect(await screen.findByText('Added GRE.')).toBeInTheDocument();
    });

    it('does not save twice when the button is pressed twice', async () => {
      const { checklist } = open();
      const dialog = await openAddForm();
      setField(dialog, /^Type/, 'gre');
      submitAdd(dialog);
      submitAdd(dialog);
      await screen.findByText('Added GRE.');
      expect(checklist.api.add).toHaveBeenCalledTimes(1);
      expect(checklist.rows).toHaveLength(1);
    });
  });

  describe('editing a requirement', () => {
    const transcript = {
      kind: 'transcript' as const,
      status: 'in_progress' as const,
      due_date: '2027-01-15',
      notes: 'Order from the registrar.',
    };

    it('opens with the item’s current values', async () => {
      open([transcript]);
      await ready();
      chooseAction('Transcript', 'Edit');
      const dialog = await screen.findByRole('dialog', { name: 'Edit requirement' });
      expect(dialog).toHaveTextContent('Transcript');
      expect(field(dialog, /^Type/)).toHaveValue('transcript');
      expect(field(dialog, 'Status')).toHaveValue('in_progress');
      expect(field(dialog, 'Due date')).toHaveValue('2027-01-15');
      expect(field(dialog, 'Notes')).toHaveValue('Order from the registrar.');
      expect(field(dialog, 'Required')).toBeChecked();
    });

    it('saves the changes', async () => {
      const { checklist } = open([transcript, { kind: 'resume_cv' }]);
      await ready();
      chooseAction('Transcript', 'Edit');
      const dialog = await screen.findByRole('dialog', { name: 'Edit requirement' });
      setField(dialog, 'Status', 'submitted');
      setField(dialog, 'Due date', '');
      setField(dialog, 'Notes', 'Sent on the 3rd.');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Saved Transcript.')).toBeInTheDocument();
      await gone('Edit requirement');
      const id = checklist.rows.find((row) => row.kind === 'transcript')!.id;
      expect(checklist.api.update).toHaveBeenCalledWith(id, {
        kind: 'transcript',
        label: null,
        is_required: true,
        status: 'submitted',
        due_date: null,
        notes: 'Sent on the 3rd.',
      });
      expect(statusOf('Transcript')).toBe('Submitted');
      expect(within(rowFor('Transcript')).getByText('Sent on the 3rd.')).toBeInTheDocument();
      expect(within(rowFor('Transcript')).queryByText(/^Due/)).not.toBeInTheDocument();
    });

    it('can rename an item, and the list follows', async () => {
      open([{ kind: 'supplemental_essay', label: 'Why Stanford?' }]);
      await ready();
      chooseAction('Why Stanford?', 'Edit');
      const dialog = await screen.findByRole('dialog', { name: 'Edit requirement' });
      setField(dialog, 'Name', 'Why Stanford? (draft 2)');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved Why Stanford? (draft 2).')).toBeInTheDocument();
      expect(titles()).toEqual(['Why Stanford? (draft 2)']);
    });

    it('takes an item out of the progress when you make it optional', async () => {
      open([{ kind: 'resume_cv', status: 'complete' }, { kind: 'transcript' }]);
      await ready();
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      chooseAction('Transcript', 'Edit');
      const dialog = await screen.findByRole('dialog', { name: 'Edit requirement' });
      fireEvent.click(field(dialog, 'Required'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      await screen.findByText('Saved Transcript.');
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('does not offer a letter number when editing', async () => {
      open([{ kind: 'gre' }]);
      await ready();
      chooseAction('GRE', 'Edit');
      const dialog = await screen.findByRole('dialog', { name: 'Edit requirement' });
      setField(dialog, /^Type/, 'recommendation_letter');
      expect(field(dialog, 'Name')).toHaveValue('');
    });

    it('says so when the item was deleted elsewhere', async () => {
      const { checklist } = open([transcript]);
      await ready();
      chooseAction('Transcript', 'Edit');
      const dialog = await screen.findByRole('dialog', { name: 'Edit requirement' });
      checklist.api.update.mockRejectedValueOnce(new DataError('not_found'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await within(dialog).findByText('Failed to save requirement')).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        'That requirement no longer exists. It may have been deleted in another tab.',
      );
    });
  });

  describe('changing a status', () => {
    it('moves the item at once and saves it', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      await ready();
      changeStatus('Transcript', 'Complete');
      expect(
        await screen.findByRole('button', { name: /^Complete\. Change status/ }),
      ).toBeVisible();
      await waitFor(() =>
        expect(checklist.api.setStatus).toHaveBeenCalledWith(checklist.rows[0]!.id, 'complete'),
      );
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('offers all four statuses and marks the current one', async () => {
      open([{ kind: 'transcript', status: 'submitted' }]);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: /Change status of Transcript$/ }));
      const items = screen.getAllByRole('menuitemradio');
      expect(items.map((item) => item.textContent)).toEqual([
        'Not Started',
        'In Progress',
        'Complete',
        'Submitted',
      ]);
      expect(screen.getByRole('menuitemradio', { name: 'Submitted' })).toBeChecked();
    });

    it('does nothing when you pick the status it already has', async () => {
      const { checklist } = open([{ kind: 'transcript', status: 'complete' }]);
      await ready();
      changeStatus('Transcript', 'Complete');
      expect(checklist.api.setStatus).not.toHaveBeenCalled();
    });

    it('puts the old status back and explains when saving fails', async () => {
      const { checklist } = open([{ kind: 'transcript' }, { kind: 'gre', status: 'complete' }]);
      checklist.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      changeStatus('Transcript', 'Submitted');
      expect(await screen.findByText("Couldn't update that requirement")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      await waitFor(() => expect(statusOf('Transcript')).toBe('Not Started'));
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("Couldn't update that requirement")).not.toBeInTheDocument();
    });

    it('applies two quick changes to the same item in the order they were made', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      await ready();
      changeStatus('Transcript', 'In Progress');
      changeStatus('Transcript', 'Complete');
      await waitFor(() => expect(checklist.api.setStatus).toHaveBeenCalledTimes(2));
      expect(checklist.api.setStatus.mock.calls.map(([, status]) => status)).toEqual([
        'in_progress',
        'complete',
      ]);
      await waitFor(() => expect(checklist.rows[0]!.status).toBe('complete'));
      expect(statusOf('Transcript')).toBe('Complete');
    });

    it('lets a change to one item stand when another one fails', async () => {
      const { checklist } = open([{ kind: 'resume_cv' }, { kind: 'transcript' }]);
      await ready();
      checklist.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Resume / CV', 'Complete');
      changeStatus('Transcript', 'Complete');
      await screen.findByText("Couldn't update that requirement");
      await waitFor(() => expect(statusOf('Resume / CV')).toBe('Not Started'));
      expect(statusOf('Transcript')).toBe('Complete');
    });
  });

  describe('deleting a requirement', () => {
    async function askToDelete(title = 'Transcript') {
      chooseAction(title, 'Delete…');
      return screen.findByRole('dialog', { name: 'Delete this requirement?' });
    }

    it('asks first, and names the item', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      await ready();
      const dialog = await askToDelete();
      expect(dialog).toHaveTextContent('“Transcript” will be removed from this checklist.');
      expect(dialog).toHaveTextContent("can't be undone");
      expect(checklist.api.remove).not.toHaveBeenCalled();
    });

    it('keeps the item when you cancel', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      await ready();
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this requirement?');
      expect(titles()).toEqual(['Transcript']);
      expect(checklist.api.remove).not.toHaveBeenCalled();
    });

    it('deletes the item and updates the progress', async () => {
      const { checklist } = open([{ kind: 'transcript', status: 'complete' }, { kind: 'gre' }]);
      await ready();
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      const dialog = await askToDelete('GRE');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));
      expect(await screen.findByText('Deleted GRE.')).toBeInTheDocument();
      await gone('Delete this requirement?');
      expect(titles()).toEqual(['Transcript']);
      expect(checklist.rows).toHaveLength(1);
      expect(screen.getByText('1 of 1')).toBeInTheDocument();
    });

    it('goes back to the invitation after the last item is deleted', async () => {
      open([{ kind: 'transcript' }]);
      await ready();
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));
      expect(await screen.findByRole('heading', { name: 'No requirements yet.' })).toBeVisible();
      expect(screen.getByText('Deleted Transcript.')).toBeInTheDocument();
    });

    it('stays open and explains when deleting fails', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      checklist.api.remove.mockRejectedValueOnce(new DataError('network'));
      await ready();
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));
      expect(await within(dialog).findByText("Couldn't delete this requirement")).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(titles()).toEqual(['Transcript']);
      // Trying again works.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));
      expect(await screen.findByText('Deleted Transcript.')).toBeInTheDocument();
    });

    it('does not show an old failure the next time it opens', async () => {
      const { checklist } = open([{ kind: 'transcript' }, { kind: 'gre' }]);
      checklist.api.remove.mockRejectedValueOnce(new DataError('network'));
      await ready();
      let dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete requirement' }));
      await within(dialog).findByText("Couldn't delete this requirement");
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this requirement?');
      dialog = await askToDelete('GRE');
      expect(within(dialog).queryByText("Couldn't delete this requirement")).toBeNull();
    });
  });

  describe('when the server is not reachable', () => {
    it('says the checklist could not be loaded, and tries again on request', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      checklist.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load requirements')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: 'No requirements yet.' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(titles()).toEqual(['Transcript']);
    });

    it('keeps showing the last checklist when a refresh fails', async () => {
      const { checklist } = open([{ kind: 'transcript' }]);
      await ready();
      checklist.api.list.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Transcript', 'Complete');
      expect(await screen.findByText('Unable to refresh requirements')).toBeInTheDocument();
      expect(titles()).toEqual(['Transcript']);
      expect(screen.getByText(/Showing the last checklist that loaded\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh requirements')).not.toBeInTheDocument(),
      );
    });
  });

  describe('when the program is deleted', () => {
    it('takes its checklist out of what is remembered', async () => {
      const { checklist, queryClient } = open(
        [{ kind: 'transcript' }, { kind: 'gre', application_id: 'some-other-program' }],
        stanford(),
        '',
      );
      await screen.findByRole('heading', { level: 1, name: 'Stanford University' });
      fireEvent.click(screen.getByRole('link', { name: 'Requirements' }));
      await ready();
      const remembered = () =>
        queryClient.getQueryData<RequirementRow[]>(['requirements', 'user-1']);
      expect(remembered()).toHaveLength(2);

      // The fake database keeps the rows (the real one deletes them along with the program), so
      // hold back the reload to see what was done to the remembered list itself.
      checklist.api.list.mockImplementation(() => new Promise(() => {}));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      await screen.findByRole('heading', { name: 'No applications yet.' });

      expect(remembered()?.map((row) => row.application_id)).toEqual(['some-other-program']);
    });
  });
});
