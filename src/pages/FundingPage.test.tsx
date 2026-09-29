import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { FundingRow } from '@/features/funding/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeFundingApi, fakeFunding } from '@/test/fakeFundingApi';
import { renderApp } from '@/test/renderApp';

const stanford = () =>
  fakeRecord({
    id: 'stanford',
    program_name: 'Computer Science',
    university: { name: 'Stanford University' },
  });
const toronto = () =>
  fakeRecord({
    id: 'toronto',
    program_name: 'Applied Computing',
    fee_currency: 'CAD',
    university: { name: 'University of Toronto' },
  });

type Item = Partial<FundingRow> & { name: string };

function open({
  items = [],
  programs = [stanford(), toronto()],
}: { items?: Item[]; programs?: ReturnType<typeof stanford>[] } = {}) {
  const applications = createFakeApplicationsApi(programs);
  const funding = createFakeFundingApi(
    items.map((item) => fakeFunding({ id: item.name, ...item })),
  );
  const view = renderApp('/app/funding', createFakeAuth(fakeSession()).client, {
    api: applications.api,
    fundingApi: funding.api,
  });
  return { ...view, applications, funding };
}

const ready = () => screen.findByRole('list', { name: 'Funding' });
const list = () => screen.getByRole('list', { name: 'Funding' });
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

const field = (dialog: HTMLElement, label: RegExp | string) =>
  within(dialog).getByLabelText(label) as HTMLInputElement;
const setField = (dialog: HTMLElement, label: RegExp | string, value: string) =>
  fireEvent.change(field(dialog, label), { target: { value } });
const gone = (name: string) =>
  waitFor(() => expect(screen.queryByRole('dialog', { name })).not.toBeInTheDocument());

function chooseAction(name: string, action: 'Edit funding' | 'Delete funding…') {
  fireEvent.click(within(rowFor(name)).getByRole('button', { name: `Actions for ${name}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
}

describe('the funding page', () => {
  describe('getting there', () => {
    it('is in the sidebar', async () => {
      open();
      await screen.findByRole('heading', { level: 1, name: 'Funding' });
      const nav = screen.getAllByRole('navigation', { name: 'Primary' })[0]!;
      expect(within(nav).getByRole('link', { name: 'Funding' })).toHaveAttribute(
        'href',
        '/app/funding',
      );
      expect(within(nav).getByRole('link', { name: 'Funding' })).toHaveAttribute(
        'aria-current',
        'page',
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
      release();
      await ready();
      expect(names()).toEqual(['Fellowship']);
    });
  });

  describe('with nothing tracked', () => {
    it('invites you to add the first item, with the program left for you to choose', async () => {
      open();
      expect(await screen.findByRole('heading', { name: 'No funding tracked yet.' })).toBeVisible();
      // The only "Add funding" is the one in the empty state, not one in the page header as well.
      expect(screen.getAllByRole('button', { name: 'Add funding' })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Add funding' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add funding' });
      expect(field(dialog, /^Program/)).toHaveValue('');
      expect(field(dialog, 'Currency')).toHaveValue('USD');
    });
  });

  describe('the items', () => {
    it('lists funding from every program, offers after what you can still apply for', async () => {
      open({
        items: [
          { name: 'Offer', application_id: 'toronto', status: 'offered' },
          { name: 'Later', application_id: 'stanford', status: 'applying', deadline: '2027-01-15' },
          { name: 'Outside', application_id: null, status: 'researching', deadline: '2026-11-30' },
        ],
      });
      await ready();
      expect(names()).toEqual(['Outside', 'Later', 'Offer']);
    });

    it('names the program of each item, with a link to that program’s funding', async () => {
      open({
        items: [
          { name: 'Fellowship', application_id: 'stanford' },
          { name: 'Outside grant', application_id: null },
          { name: 'Orphan', application_id: 'deleted-elsewhere' },
        ],
      });
      await ready();
      expect(
        within(rowFor('Fellowship')).getByRole('link', {
          name: 'Stanford University, Computer Science',
        }),
      ).toHaveAttribute('href', '/app/applications/stanford/funding');
      expect(rowFor('Outside grant')).toHaveTextContent('Not tied to a program');
      expect(within(rowFor('Outside grant')).queryByRole('link')).not.toBeInTheDocument();
      expect(rowFor('Orphan')).toHaveTextContent('Unknown program');
    });

    it('adds up the money per currency', async () => {
      open({
        items: [
          { name: 'A', application_id: 'stanford', status: 'accepted', amount: 30_000 },
          {
            name: 'B',
            application_id: 'toronto',
            status: 'accepted',
            amount: 8_000,
            currency: 'CAD',
          },
          { name: 'C', application_id: null, status: 'offered', amount: 1_000 },
          { name: 'D', application_id: 'stanford', status: 'applied', amount: 2_500 },
        ],
      });
      await ready();
      const totals = screen
        .getByText('Funding at a glance')
        .closest('div.rounded-lg') as HTMLElement;
      const term = (label: string) => within(totals).getByText(label).nextElementSibling;
      expect(term('Accepted')).toHaveTextContent('CA$8,000 + $30,000');
      expect(term('Offered')).toHaveTextContent('$1,000');
      expect(term('Waiting to hear')).toHaveTextContent('$2,500');
    });

    it('counts down using the state of the item’s own program', async () => {
      open({
        programs: [
          fakeRecord({
            id: 'stanford',
            status: 'withdrawn',
            university: { name: 'Stanford University' },
          }),
          toronto(),
        ],
        items: [
          {
            name: 'Closed',
            application_id: 'stanford',
            status: 'applying',
            deadline: daysFromNow(-3),
          },
          {
            name: 'Missed',
            application_id: 'toronto',
            status: 'applying',
            deadline: daysFromNow(-3),
          },
          { name: 'Outside', application_id: null, status: 'applying', deadline: daysFromNow(-3) },
        ],
      });
      await ready();
      expect(rowFor('Closed')).not.toHaveTextContent('overdue');
      expect(within(rowFor('Missed')).getByText('3 days overdue')).toBeInTheDocument();
      expect(within(rowFor('Outside')).getByText('3 days overdue')).toBeInTheDocument();
    });
  });

  describe('adding funding', () => {
    async function openAddForm() {
      fireEvent.click((await screen.findAllByRole('button', { name: 'Add funding' }))[0]!);
      return screen.findByRole('dialog', { name: 'Add funding' });
    }

    it('lets you choose the program, or none, and lists them by name', async () => {
      open({ items: [{ name: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      expect(
        within(field(dialog, /^Program/))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        'Not tied to a program',
        'Stanford University, Computer Science',
        'University of Toronto, Applied Computing',
      ]);
      expect(field(dialog, /^Program/)).toHaveValue('');
    });

    it('saves funding for the chosen program', async () => {
      const { funding } = open({ items: [{ name: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'Research assistantship');
      setField(dialog, /^Type/, 'research_assistantship');
      setField(dialog, /^Program/, 'stanford');
      setField(dialog, 'Amount', '48000');
      submitAdd(dialog);
      expect(await screen.findByText('Added Research assistantship.')).toBeInTheDocument();
      await gone('Add funding');
      expect(funding.api.create.mock.calls[0]![0]).toMatchObject({
        application_id: 'stanford',
        name: 'Research assistantship',
        kind: 'research_assistantship',
        amount: 48_000,
        currency: 'USD',
      });
      expect(
        within(rowFor('Research assistantship')).getByRole('link', {
          name: 'Stanford University, Computer Science',
        }),
      ).toBeInTheDocument();
    });

    it('saves funding that belongs to no program', async () => {
      const { funding } = open({ items: [{ name: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      setField(dialog, /^Name/, 'Rotary scholarship');
      setField(dialog, /^Type/, 'external_scholarship');
      submitAdd(dialog);
      expect(await screen.findByText('Added Rotary scholarship.')).toBeInTheDocument();
      expect(funding.api.create.mock.calls[0]![0]).toMatchObject({ application_id: null });
      expect(rowFor('Rotary scholarship')).toHaveTextContent('Not tied to a program');
    });

    it('follows the program’s currency until you pick one yourself', async () => {
      open({ items: [{ name: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      expect(field(dialog, 'Currency')).toHaveValue('USD');
      setField(dialog, /^Program/, 'toronto');
      expect(field(dialog, 'Currency')).toHaveValue('CAD');
      setField(dialog, /^Program/, 'stanford');
      expect(field(dialog, 'Currency')).toHaveValue('USD');
      setField(dialog, 'Currency', 'EUR');
      setField(dialog, /^Program/, 'toronto');
      expect(field(dialog, 'Currency')).toHaveValue('EUR');
    });

    it('explains a missing name without saving', async () => {
      const { funding } = open({ items: [{ name: 'Existing' }] });
      await ready();
      const dialog = await openAddForm();
      submitAdd(dialog);
      expect(
        await within(dialog).findByText('Enter a name, like "Departmental fellowship".'),
      ).toBeInTheDocument();
      expect(funding.api.create).not.toHaveBeenCalled();
    });
  });

  describe('editing and deleting', () => {
    it('edits an item in place', async () => {
      const { funding } = open({
        items: [{ name: 'Fellowship', application_id: 'stanford', status: 'applied', amount: 100 }],
      });
      await ready();
      chooseAction('Fellowship', 'Edit funding');
      const dialog = await screen.findByRole('dialog', { name: 'Edit funding' });
      expect(field(dialog, /^Program/)).toHaveValue('stanford');
      setField(dialog, 'Status', 'accepted');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
      expect(await screen.findByText('Saved Fellowship.')).toBeInTheDocument();
      expect(funding.api.update.mock.calls[0]![1]).toMatchObject({ status: 'accepted' });
      expect(statusOf('Fellowship')).toBe('Accepted');
    });

    it('changes a status from the row and puts it back when saving fails', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'applied' }] });
      funding.api.setStatus.mockRejectedValueOnce(new DataError('network'));
      await ready();
      fireEvent.click(statusButton('Fellowship'));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Offered' }));
      expect(await screen.findByText("Couldn't update that funding item")).toBeInTheDocument();
      await waitFor(() => expect(statusOf('Fellowship')).toBe('Applied'));
    });

    it('deletes an item after asking', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }, { name: 'Grant' }] });
      await ready();
      chooseAction('Grant', 'Delete funding…');
      const dialog = await screen.findByRole('dialog', { name: 'Delete this funding item?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete funding' }));
      expect(await screen.findByText('Deleted Grant.')).toBeInTheDocument();
      expect(names()).toEqual(['Fellowship']);
      expect(funding.rows.map((row) => row.name)).toEqual(['Fellowship']);
    });
  });

  describe('when something cannot be loaded', () => {
    it('says the funding could not be loaded, and tries again on request', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship' }] });
      funding.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load funding')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
      expect(names()).toEqual(['Fellowship']);
    });

    it('does the same when the programs cannot be loaded', async () => {
      const { applications } = open({ items: [{ name: 'Fellowship' }] });
      applications.api.list.mockRejectedValueOnce(new DataError('network'));
      expect(await screen.findByText('Unable to load funding')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await ready();
    });

    it('keeps showing the last list when a refresh fails', async () => {
      const { funding } = open({ items: [{ name: 'Fellowship', status: 'applied' }] });
      await ready();
      funding.api.list.mockRejectedValueOnce(new DataError('network'));
      fireEvent.click(statusButton('Fellowship'));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Offered' }));
      expect(await screen.findByText('Unable to refresh funding')).toBeInTheDocument();
      expect(names()).toEqual(['Fellowship']);
    });
  });
});

function submitAdd(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add funding' }));
}
