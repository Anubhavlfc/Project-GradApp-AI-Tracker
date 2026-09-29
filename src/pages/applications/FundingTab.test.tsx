import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { FundingRow } from '@/features/funding/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeFundingApi, fakeFunding } from '@/test/fakeFundingApi';
import { renderApp } from '@/test/renderApp';

const stanford = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    status: 'documents_in_progress',
    university: { name: 'Stanford University' },
    ...overrides,
  });

type Item = Partial<FundingRow> & { name: string };

/** Opens one program's Funding tab, with these funding items on file (for this program by default). */
function open({
  items = [],
  record = stanford(),
  otherPrograms = [],
  path = 'funding',
}: {
  items?: Item[];
  record?: ReturnType<typeof stanford>;
  otherPrograms?: ReturnType<typeof stanford>[];
  path?: string;
} = {}) {
  const applications = createFakeApplicationsApi([record, ...otherPrograms]);
  const funding = createFakeFundingApi(
    items.map((item) => fakeFunding({ id: item.name, application_id: record.id, ...item })),
  );
  const view = renderApp(
    `/app/applications/${record.id}/${path}`,
    createFakeAuth(fakeSession()).client,
    { api: applications.api, fundingApi: funding.api },
  );
  return { ...view, record, applications, funding };
}

const list = () => screen.getByRole('list', { name: 'Funding' });
const ready = () => screen.findByRole('list', { name: 'Funding' });
/** The items on the list, top to bottom. */
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
function chooseAction(name: string, action: 'Edit funding' | 'Delete funding…') {
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
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add funding' }))[0]!);
  return screen.findByRole('dialog', { name: 'Add funding' });
}
const submitAdd = (dialog: HTMLElement) =>
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add funding' }));

describe('a program’s funding tab', () => {
  describe('getting there', () => {
    it('is a tab on the program page', async () => {
      const { record } = open({ path: '' });
      const tabs = await screen.findByRole('navigation', { name: 'Sections of this program' });
      fireEvent.click(within(tabs).getByRole('link', { name: 'Funding' }));
      expect(await screen.findByRole('heading', { name: 'No funding tracked yet.' })).toBeVisible();
      expect(within(tabs).getByRole('link', { name: 'Funding' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Funding' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/funding`,
      );
    });

    it('shows that it is loading, then the funding', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      let release = () => {};
      funding.api.list.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve(funding.rows);
          }),
      );
      expect(await screen.findByText('Loading funding')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Funding' })).not.toBeInTheDocument();
      release();
      await ready();
      expect(names()).toEqual(['Fellowship']);
    });
  });

  describe('with no funding', () => {
    it('invites you to add the first item', async () => {
      open();
      expect(await screen.findByRole('heading', { name: 'No funding tracked yet.' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add funding' })).toBeEnabled();
      expect(screen.queryByText('Funding at a glance')).not.toBeInTheDocument();
    });
  });

  describe('the items', () => {
    it('lists what you can still apply for by deadline, then the rest, offers first', async () => {
      open({
        items: [
          { name: 'Waiting', status: 'applied' },
          { name: 'Later', status: 'applying', deadline: '2026-12-15' },
          { name: 'Offer', status: 'offered' },
          { name: 'No date', status: 'researching', deadline: null },
          { name: 'Sooner', status: 'researching', deadline: '2026-11-20' },
        ],
      });
      await ready();
      expect(names()).toEqual(['Sooner', 'Later', 'No date', 'Offer', 'Waiting']);
    });

    it('shows the type, amount, deadline, link and notes of an item', async () => {
      open({
        items: [
          {
            name: 'Knight-Hennessy',
            kind: 'fellowship',
            amount: 90_000,
            currency: 'USD',
            status: 'applying',
            deadline: '2027-01-05',
            application_required: true,
            url: 'https://www.kh.stanford.edu/apply',
            notes: 'Essay due first.',
          },
        ],
      });
      await ready();
      const row = rowFor('Knight-Hennessy');
      expect(row).toHaveTextContent('Fellowship · $90,000 · Application required');
      expect(row).toHaveTextContent('Due Jan 5, 2027');
      expect(within(row).getByRole('link', { name: /kh\.stanford\.edu/ })).toHaveAttribute(
        'href',
        'https://www.kh.stanford.edu/apply',
      );
      expect(within(row).getByText('Essay due first.')).toBeInTheDocument();
      expect(statusOf('Knight-Hennessy')).toBe('Applying');
    });

    it('leaves out what is not known', async () => {
      open({ items: [{ name: 'Mystery grant', kind: 'other' }] });
      await ready();
      const row = rowFor('Mystery grant');
      expect(row).toHaveTextContent(/^Mystery grantOtherResearching/);
      expect(row).not.toHaveTextContent(/\$|Due|Application required/);
      expect(within(row).queryByRole('link')).not.toBeInTheDocument();
    });

    it('does not name the program on every row: you are already on its page', async () => {
      open({ items: [{ name: 'Fellowship' }] });
      await ready();
      expect(rowFor('Fellowship')).not.toHaveTextContent('Stanford');
    });

    it('only shows this program’s funding', async () => {
      open({
        items: [
          { name: 'Ours' },
          { name: 'Theirs', application_id: 'some-other-program' },
          { name: 'Nobody’s', application_id: null },
        ],
      });
      await ready();
      expect(names()).toEqual(['Ours']);
    });

    it('adds up what you have accepted, been offered and are waiting on, per currency', async () => {
      open({
        items: [
          { name: 'A', status: 'accepted', amount: 20_000 },
          { name: 'B', status: 'accepted', amount: 5_000, currency: 'GBP' },
          { name: 'C', status: 'offered', amount: 10_000 },
          { name: 'D', status: 'applied', amount: 3_000 },
          { name: 'E', status: 'researching', amount: 4_000_000 },
          { name: 'F', status: 'rejected', amount: 9_000_000 },
        ],
      });
      await ready();
      const totals = screen
        .getByText('Funding at a glance')
        .closest('div.rounded-lg') as HTMLElement;
      const term = (label: string) => within(totals).getByText(label).nextElementSibling;
      expect(term('Accepted')).toHaveTextContent('£5,000 + $20,000');
      expect(term('Offered')).toHaveTextContent('$10,000');
      expect(term('Waiting to hear')).toHaveTextContent('$3,000');
    });

    it('shows no totals when nothing has an amount', async () => {
      open({ items: [{ name: 'A', status: 'accepted', amount: null }] });
      await ready();
      expect(screen.queryByText('Funding at a glance')).not.toBeInTheDocument();
    });
  });

  describe('deadlines', () => {
    it('warns as a deadline nears and when it has passed, while you can still apply', async () => {
      open({
        items: [
          { name: 'Soon', status: 'applying', deadline: daysFromNow(3) },
          { name: 'Missed', status: 'researching', deadline: daysFromNow(-2) },
          { name: 'Far', status: 'applying', deadline: daysFromNow(200) },
        ],
      });
      await ready();
      expect(within(rowFor('Soon')).getByText('In 3 days')).toBeInTheDocument();
      expect(within(rowFor('Missed')).getByText('2 days overdue')).toBeInTheDocument();
      expect(rowFor('Far')).not.toHaveTextContent(/overdue|In \d+ days/);
    });

    it('does not call it overdue once you have applied or heard back', async () => {
      open({
        items: [
          { name: 'Sent', status: 'applied', deadline: daysFromNow(-5) },
          { name: 'Won', status: 'accepted', deadline: daysFromNow(-5) },
        ],
      });
      await ready();
      for (const name of ['Sent', 'Won']) {
        expect(rowFor(name)).not.toHaveTextContent('overdue');
        expect(rowFor(name)).toHaveTextContent('Due');
      }
    });

    it('does not call it overdue when the program was withdrawn', async () => {
      open({
        record: stanford({ status: 'withdrawn' }),
        items: [{ name: 'Fellowship', status: 'applying', deadline: daysFromNow(-5) }],
      });
      await ready();
      expect(rowFor('Fellowship')).not.toHaveTextContent('overdue');
    });

    it('still counts down after the program has been submitted: a scholarship can be due later', async () => {
      open({
        record: stanford({ status: 'submitted' }),
        items: [{ name: 'Fellowship', status: 'applying', deadline: daysFromNow(5) }],
      });
      await ready();
      expect(within(rowFor('Fellowship')).getByText('In 5 days')).toBeInTheDocument();
    });
  });

  describe('adding funding', () => {
    it('starts with the program decided and sensible defaults', async () => {
      open({ record: stanford({ fee_currency: 'CAD' }) });
      const dialog = await openAddForm();
      expect(dialog).toHaveTextContent('Stanford University, Computer Science');
      expect(within(dialog).queryByRole('combobox', { name: /^Program/ })).toBeNull();
      expect(field(dialog, /^Name/)).toHaveFocus();
      expect(field(dialog, /^Type/)).toHaveValue('university_scholarship');
      expect(field(dialog, 'Status')).toHaveValue('researching');
      expect(field(dialog, 'Currency')).toHaveValue('CAD');
      expect(field(dialog, 'Application required')).not.toBeChecked();
    });

    it('saves an item for this program', async () => {
      const { funding, record } = open();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, '  Dean’s   fellowship ');
      setField(dialog, /^Type/, 'fellowship');
      setField(dialog, 'Amount', '25,000');
      setField(dialog, 'Currency', 'GBP');
      setField(dialog, 'Status', 'applying');
      setField(dialog, 'Deadline', '2026-12-01');
      fireEvent.click(field(dialog, 'Application required'));
      setField(dialog, 'Link', 'stanford.edu/fellowships');
      setField(dialog, 'Notes', 'Ask the department.');
      submitAdd(dialog);

      expect(await screen.findByText('Added Dean’s fellowship.')).toBeInTheDocument();
      await gone('Add funding');
      expect(funding.api.create).toHaveBeenCalledWith({
        application_id: record.id,
        name: 'Dean’s fellowship',
        kind: 'fellowship',
        amount: 25_000,
        currency: 'GBP',
        deadline: '2026-12-01',
        application_required: true,
        status: 'applying',
        url: 'https://stanford.edu/fellowships',
        notes: 'Ask the department.',
      });
      expect(names()).toEqual(['Dean’s fellowship']);
      expect(rowFor('Dean’s fellowship')).toHaveTextContent('Fellowship · £25,000');
    });

    it('needs only a name', async () => {
      const { funding } = open();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'Something');
      submitAdd(dialog);
      expect(await screen.findByText('Added Something.')).toBeInTheDocument();
      expect(funding.api.create.mock.calls[0]![0]).toMatchObject({
        amount: null,
        deadline: null,
        url: null,
        notes: null,
        application_required: false,
      });
    });

    it('explains what is wrong without saving anything', async () => {
      const { funding } = open();
      const dialog = await openAddForm();
      setField(dialog, 'Amount', 'lots');
      setField(dialog, 'Link', 'not a link');
      submitAdd(dialog);
      expect(
        await within(dialog).findByText('Enter a name, like "Departmental fellowship".'),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText('Enter an amount between 0 and 1,000,000, like 90 or 90.50.'),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText('Enter a web address, like https://example.edu.'),
      ).toBeInTheDocument();
      expect(field(dialog, /^Name/)).toHaveAttribute('aria-invalid', 'true');
      expect(field(dialog, /^Name/)).toHaveFocus();
      expect(funding.api.create).not.toHaveBeenCalled();
    });

    it('stays open and explains when saving fails, and works on the next try', async () => {
      const { funding } = open();
      funding.api.create.mockRejectedValueOnce(new DataError('network'));
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'Fellowship');
      setField(dialog, 'Amount', '500');
      submitAdd(dialog);
      expect(await within(dialog).findByText('Failed to save funding')).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(field(dialog, 'Amount')).toHaveValue('500');
      submitAdd(dialog);
      expect(await screen.findByText('Added Fellowship.')).toBeInTheDocument();
    });

    it('says so when the program was deleted in another tab', async () => {
      const { funding } = open();
      funding.api.create.mockRejectedValueOnce(
        new DataError('unknown', { cause: { code: '23503' } }),
      );
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'Fellowship');
      submitAdd(dialog);
      expect(
        await within(dialog).findByText(
          'The program was deleted in another tab. Reload the page and try again.',
        ),
      ).toBeVisible();
    });

    it('starts clean each time it opens', async () => {
      open();
      let dialog = await openAddForm();
      setField(dialog, /^Name/, 'half written');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Add funding');
      dialog = await openAddForm();
      expect(field(dialog, /^Name/)).toHaveValue('');
    });
  });

  describe('editing funding', () => {
    it('shows the saved values and saves the changes', async () => {
      const { funding, record } = open({
        items: [
          {
            name: 'Fellowship',
            kind: 'fellowship',
            amount: 1000.5,
            currency: 'EUR',
            deadline: '2026-11-01',
            application_required: true,
            status: 'applied',
            url: 'https://example.edu/f',
            notes: 'note',
          },
        ],
      });
      await ready();
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      expect(dialog).toHaveTextContent('Fellowship');
      expect(field(dialog, /^Name/)).toHaveValue('Fellowship');
      expect(field(dialog, /^Type/)).toHaveValue('fellowship');
      expect(field(dialog, /^Program/)).toHaveValue(record.id);
      expect(field(dialog, 'Amount')).toHaveValue('1000.5');
      expect(field(dialog, 'Currency')).toHaveValue('EUR');
      expect(field(dialog, 'Status')).toHaveValue('applied');
      expect(field(dialog, 'Deadline')).toHaveValue('2026-11-01');
      expect(field(dialog, 'Application required')).toBeChecked();
      expect(field(dialog, 'Link')).toHaveValue('https://example.edu/f');
      expect(field(dialog, 'Notes')).toHaveValue('note');

      setField(dialog, 'Status', 'offered');
      setField(dialog, 'Amount', '2000');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Saved Fellowship.')).toBeInTheDocument();
      await gone('Edit funding');
      expect(funding.api.update).toHaveBeenCalledWith('Fellowship', {
        application_id: record.id,
        name: 'Fellowship',
        kind: 'fellowship',
        amount: 2000,
        currency: 'EUR',
        deadline: '2026-11-01',
        application_required: true,
        status: 'offered',
        url: 'https://example.edu/f',
        notes: 'note',
      });
      expect(statusOf('Fellowship')).toBe('Offered');
      expect(rowFor('Fellowship')).toHaveTextContent('€2,000');
    });

    it('can move an item to another program, and it leaves this list', async () => {
      const columbia = stanford({ university: { name: 'Columbia University' } });
      const { funding } = open({
        otherPrograms: [columbia],
        items: [{ name: 'Fellowship' }, { name: 'Grant' }],
      });
      await ready();
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      const programs = within(field(dialog, /^Program/)).getAllByRole('option');
      expect(programs.map((option) => option.textContent)).toEqual([
        'Not tied to a program',
        'Columbia University, Computer Science',
        'Stanford University, Computer Science',
      ]);
      setField(dialog, /^Program/, columbia.id);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      await gone('Edit funding');
      expect(funding.api.update.mock.calls[0]![1]).toMatchObject({ application_id: columbia.id });
      await waitFor(() => expect(names()).toEqual(['Grant']));
    });

    it('keeps the currency of a saved item when it is moved to a program that uses another one', async () => {
      const toronto = stanford({
        university: { name: 'University of Toronto' },
        fee_currency: 'CAD',
      });
      const { funding } = open({
        otherPrograms: [toronto],
        items: [{ name: 'Fellowship', currency: 'EUR', amount: 100 }],
      });
      await ready();
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      setField(dialog, /^Program/, toronto.id);
      expect(field(dialog, 'Currency')).toHaveValue('EUR');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      await gone('Edit funding');
      expect(funding.api.update.mock.calls[0]![1]).toMatchObject({ currency: 'EUR', amount: 100 });
    });

    it('can make an item tied to no program', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      await ready();
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      setField(dialog, /^Program/, '');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      await gone('Edit funding');
      expect(funding.api.update.mock.calls[0]![1]).toMatchObject({ application_id: null });
    });

    it('keeps the saved currency when it is not one of the usual ones', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', currency: 'NOK' }] });
      await ready();
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      expect(field(dialog, 'Currency')).toHaveValue('NOK');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      await gone('Edit funding');
      expect(funding.api.update.mock.calls[0]![1]).toMatchObject({ currency: 'NOK' });
    });

    it('says so when the item was deleted in another tab', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      await ready();
      funding.api.update.mockRejectedValueOnce(new DataError('not_found'));
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await within(dialog).findByText(/That funding item no longer exists/)).toBeVisible();
    });
  });

  describe('changing a status', () => {
    it('moves the item at once and saves it', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'applied', amount: 500 }] });
      await ready();
      changeStatus('Fellowship', 'Accepted');
      expect(
        await screen.findByRole('button', { name: /^Accepted\. Change status/ }),
      ).toBeVisible();
      await waitFor(() =>
        expect(funding.api.setStatus).toHaveBeenCalledWith('Fellowship', 'accepted'),
      );
      const totals = screen
        .getByText('Funding at a glance')
        .closest('div.rounded-lg') as HTMLElement;
      expect(within(totals).getByText('Accepted').nextElementSibling).toHaveTextContent('$500');
    });

    it('offers all seven statuses and marks the current one', async () => {
      open({ items: [{ name: 'Fellowship', status: 'offered' }] });
      await ready();
      fireEvent.click(statusButton('Fellowship'));
      expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
        'Researching',
        'Applying',
        'Applied',
        'Offered',
        'Accepted',
        'Declined',
        'Rejected',
      ]);
      expect(screen.getByRole('menuitemradio', { name: 'Offered' })).toBeChecked();
    });

    it('does nothing when you pick the status it already has', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'offered' }] });
      await ready();
      changeStatus('Fellowship', 'Offered');
      expect(funding.api.setStatus).not.toHaveBeenCalled();
    });

    it('puts the old status back and explains when saving fails', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'applied' }] });
      funding.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      changeStatus('Fellowship', 'Accepted');
      expect(await screen.findByText("Couldn't update that funding item")).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      await waitFor(() => expect(statusOf('Fellowship')).toBe('Applied'));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText("Couldn't update that funding item")).not.toBeInTheDocument();
    });

    it('applies two quick changes to the same item in the order they were made', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'researching' }] });
      await ready();
      changeStatus('Fellowship', 'Applying');
      changeStatus('Fellowship', 'Applied');
      await waitFor(() => expect(funding.api.setStatus).toHaveBeenCalledTimes(2));
      expect(funding.api.setStatus.mock.calls.map(([, status]) => status)).toEqual([
        'applying',
        'applied',
      ]);
      await waitFor(() => expect(funding.rows[0]!.status).toBe('applied'));
      expect(statusOf('Fellowship')).toBe('Applied');
    });
  });

  describe('deleting funding', () => {
    async function askToDelete(name = 'Fellowship') {
      chooseAction(name, 'Delete funding…');
      return screen.findByRole('dialog', { name: 'Delete this funding item?' });
    }

    it('asks first, and names the item', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      await ready();
      const dialog = await askToDelete();
      expect(dialog).toHaveTextContent('“Fellowship” will be removed from your funding.');
      expect(funding.api.remove).not.toHaveBeenCalled();
    });

    it('keeps the item when you cancel', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      await ready();
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await gone('Delete this funding item?');
      expect(names()).toEqual(['Fellowship']);
      expect(funding.api.remove).not.toHaveBeenCalled();
    });

    it('deletes the item', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }, { name: 'Grant' }] });
      await ready();
      const dialog = await askToDelete('Grant');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete funding' }));
      expect(await screen.findByText('Deleted Grant.')).toBeInTheDocument();
      await gone('Delete this funding item?');
      expect(names()).toEqual(['Fellowship']);
      expect(funding.rows.map((row) => row.name)).toEqual(['Fellowship']);
    });

    it('goes back to the invitation after the last item is deleted', async () => {
      open({ items: [{ name: 'Fellowship' }] });
      await ready();
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete funding' }));
      expect(await screen.findByRole('heading', { name: 'No funding tracked yet.' })).toBeVisible();
    });

    it('stays open and explains when deleting fails', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      funding.api.remove.mockRejectedValueOnce(new DataError('network'));
      await ready();
      const dialog = await askToDelete();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete funding' }));
      expect(await within(dialog).findByText("Couldn't delete this funding item")).toBeVisible();
      expect(dialog).toHaveTextContent("Can't reach the server");
      expect(names()).toEqual(['Fellowship']);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete funding' }));
      expect(await screen.findByText('Deleted Fellowship.')).toBeInTheDocument();
    });
  });

  describe('when the server is not reachable', () => {
    it('says the funding could not be loaded, and tries again on request', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      funding.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load funding')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      expect(screen.queryByRole('heading', { name: 'No funding tracked yet.' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Fellowship']);
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'applied' }] });
      await ready();
      funding.api.list.mockRejectedValueOnce(new DataError('network'));
      changeStatus('Fellowship', 'Accepted');
      expect(await screen.findByText('Unable to refresh funding')).toBeInTheDocument();
      expect(names()).toEqual(['Fellowship']);
      expect(screen.getByText(/Showing the last list that loaded\./)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await waitFor(() =>
        expect(screen.queryByText('Unable to refresh funding')).not.toBeInTheDocument(),
      );
    });
  });

  describe('on the overview', () => {
    const card = async () =>
      (await screen.findByRole('heading', { name: 'Funding' })).closest(
        'div.rounded-lg',
      ) as HTMLElement;

    it('invites you to add funding when there is none', async () => {
      const { record } = open({ path: '' });
      const funding = await card();
      expect(await within(funding).findByText('No funding tracked yet.')).toBeInTheDocument();
      expect(within(funding).getByRole('link', { name: 'Add funding' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/funding`,
      );
    });

    it('shows the best news, with the money, and links to the list', async () => {
      const { record } = open({
        path: '',
        items: [
          { name: 'A', status: 'offered', amount: 5_000 },
          { name: 'B', status: 'accepted', amount: 20_000 },
          { name: 'C', status: 'researching' },
        ],
      });
      const funding = await card();
      expect(await within(funding).findByText('Accepted')).toBeInTheDocument();
      expect(funding).toHaveTextContent('$20,000');
      expect(funding).toHaveTextContent('3 items tracked');
      expect(within(funding).getByRole('link', { name: 'View funding' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/funding`,
      );
    });

    it('says how many are still being pursued when nothing has been offered', async () => {
      open({
        path: '',
        items: [
          { name: 'A', status: 'researching' },
          { name: 'B', status: 'applied' },
        ],
      });
      const funding = await card();
      expect(await within(funding).findByText('2 being pursued')).toBeInTheDocument();
    });

    it('says when the funding could not be loaded, and tries again', async () => {
      const { funding } = open({ path: '', items: [{ name: 'A', status: 'offered' }] });
      funding.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load funding')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Offered')).toBeInTheDocument();
    });
  });

  describe('when the program is deleted', () => {
    it('takes its funding out of what is remembered', async () => {
      const { funding, queryClient } = open({
        items: [{ name: 'Ours' }, { name: 'Theirs', application_id: 'some-other-program' }],
      });
      await ready();
      const remembered = () => queryClient.getQueryData<FundingRow[]>(['funding', 'user-1']);
      expect(remembered()).toHaveLength(2);

      // The fake database keeps the rows (the real one deletes them along with the program), so
      // hold back the reload to see what was done to the remembered list itself.
      funding.api.list.mockImplementation(() => new Promise(() => {}));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      await screen.findByRole('heading', { name: 'No applications yet.' });

      expect(remembered()?.map((row) => row.name)).toEqual(['Theirs']);
    });
  });
});
