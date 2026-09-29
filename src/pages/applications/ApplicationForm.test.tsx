import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { renderApp } from '@/test/renderApp';

function open(path: string, records = [] as ReturnType<typeof fakeRecord>[]) {
  const fake = createFakeApplicationsApi(records);
  const view = renderApp(path, createFakeAuth(fakeSession()).client, { api: fake.api });
  return { ...view, fake };
}

const field = (label: RegExp | string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: RegExp | string, value: string) =>
  fireEvent.change(field(label), { target: { value } });
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: /^(Add program|Save changes)$/ }));

async function openNewForm(records: ReturnType<typeof fakeRecord>[] = []) {
  const view = open('/app/applications/new', records);
  await screen.findByRole('heading', { level: 1, name: 'Add program' });
  return view;
}

describe('adding a program', () => {
  it('asks only for the essentials, then the rest is optional', async () => {
    await openNewForm();
    expect(field(/University name/)).toHaveAttribute('aria-required', 'true');
    expect(field(/Program name/)).toHaveAttribute('aria-required', 'true');
    expect(field(/^Status/)).toHaveValue('researching');
    expect(field('Degree level*')).toHaveValue('masters');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/app/applications',
    );
  });

  it('says what is missing and does not save', async () => {
    const { fake } = await openNewForm();
    save();
    expect(await screen.findByText('Enter the university name.')).toBeInTheDocument();
    expect(screen.getByText('Enter the program name.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Some fields need attention.');
    // Focus goes to the first problem so a keyboard user can fix it straight away.
    expect(field(/University name/)).toHaveFocus();
    expect(field(/University name/)).toHaveAttribute('aria-invalid', 'true');
    expect(fake.api.create).not.toHaveBeenCalled();
  });

  it('saves the program and opens its page', async () => {
    const { fake } = await openNewForm();
    type(/University name/, 'Stanford University');
    type('City', 'Stanford');
    type('State or region', 'CA');
    type('Country', 'United States');
    type(/Program name/, 'Computer Science');
    type('Degree', 'MS');
    type(/^Status/, 'planning_to_apply');
    type('Priority', 'dream');
    type('Deadline', '2026-12-15');
    type('Priority deadline', '2026-12-01');
    type('Application portal', 'apply.stanford.edu');
    type('Fee', '125');
    save();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Stanford University' }),
    ).toBeInTheDocument();
    expect(fake.api.create).toHaveBeenCalledTimes(1);
    const input = fake.api.create.mock.calls[0]![0];
    expect(input.university).toEqual({
      name: 'Stanford University',
      city: 'Stanford',
      region: 'CA',
      country: 'United States',
      website_url: null,
    });
    expect(input.application).toMatchObject({
      program_name: 'Computer Science',
      degree_type: 'MS',
      degree_level: 'masters',
      status: 'planning_to_apply',
      priority: 'dream',
      deadline: '2026-12-15',
      priority_deadline: '2026-12-01',
      portal_url: 'https://apply.stanford.edu',
      application_fee: 125,
      fee_currency: 'USD',
    });
    // The new program is already in the list without another trip to the server.
    expect(fake.records).toHaveLength(1);
  });

  it('keeps what you typed and explains when saving fails', async () => {
    const { fake } = await openNewForm();
    fake.api.create.mockRejectedValueOnce(new DataError('network'));
    type(/University name/, 'MIT');
    type(/Program name/, 'Artificial Intelligence');
    save();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to save application');
    expect(alert).toHaveTextContent("Can't reach the server");
    expect(field(/University name/)).toHaveValue('MIT');
    expect(field(/Program name/)).toHaveValue('Artificial Intelligence');
    expect(screen.getByRole('heading', { level: 1, name: 'Add program' })).toBeInTheDocument();

    // Trying again works, and the message goes away.
    save();
    expect(await screen.findByRole('heading', { level: 1, name: 'MIT' })).toBeInTheDocument();
  });

  it('checks the priority deadline against the deadline', async () => {
    const { fake } = await openNewForm();
    type(/University name/, 'MIT');
    type(/Program name/, 'AI');
    type('Deadline', '2026-12-01');
    type('Priority deadline', '2026-12-15');
    save();
    expect(
      await screen.findByText('The priority deadline must be on or before the final deadline.'),
    ).toBeInTheDocument();
    expect(field('Priority deadline')).toHaveFocus();
    expect(fake.api.create).not.toHaveBeenCalled();
  });

  it('refuses a fee that is not an amount', async () => {
    await openNewForm();
    type(/University name/, 'MIT');
    type(/Program name/, 'AI');
    type('Fee', '$90');
    save();
    expect(
      await screen.findByText('Enter an amount between 0 and 1,000,000, like 90 or 90.50.'),
    ).toBeInTheDocument();
  });

  it('refuses a link that is not a web address', async () => {
    await openNewForm();
    type(/University name/, 'MIT');
    type(/Program name/, 'AI');
    type('Application portal', 'javascript:alert(1)');
    save();
    expect(
      await screen.findByText('Enter a web address, like https://example.edu.'),
    ).toBeInTheDocument();
  });

  it('shows submission and decision fields only once the program is submitted', async () => {
    const { fake } = await openNewForm();
    expect(screen.queryByRole('heading', { name: 'After you apply' })).not.toBeInTheDocument();

    type(/^Status/, 'submitted');
    expect(screen.getByRole('heading', { name: 'After you apply' })).toBeInTheDocument();
    type('Submitted on', '2026-11-20');

    // Going back and forth does not lose what was entered.
    type(/^Status/, 'researching');
    expect(screen.queryByRole('heading', { name: 'After you apply' })).not.toBeInTheDocument();
    type(/^Status/, 'accepted');
    expect(field('Submitted on')).toHaveValue('2026-11-20');

    type(/University name/, 'MIT');
    type(/Program name/, 'AI');
    type('Reply by', '2027-04-15');
    fireEvent.click(screen.getByLabelText('This is my final choice'));
    save();
    await screen.findByRole('heading', { level: 1, name: 'MIT' });
    expect(fake.api.create.mock.calls[0]![0].application).toMatchObject({
      status: 'accepted',
      submitted_on: '2026-11-20',
      decision_deadline: '2027-04-15',
      is_final_choice: true,
    });
  });

  it('asks for the waiver status only when a waiver is available', async () => {
    const { fake } = await openNewForm();
    const status = () => screen.queryByRole('combobox', { name: 'Waiver status' });
    expect(status()).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('A fee waiver is available'));
    expect(status()).toBeInTheDocument();
    fireEvent.change(status()!, { target: { value: 'granted' } });
    type(/University name/, 'MIT');
    type(/Program name/, 'AI');
    type('Fee', '75');
    save();
    await screen.findByRole('heading', { level: 1, name: 'MIT' });
    expect(fake.api.create.mock.calls[0]![0].application).toMatchObject({
      fee_waiver_available: true,
      fee_waiver_status: 'granted',
    });
  });

  it('will not save a waiver status if no waiver is available', async () => {
    const { fake } = await openNewForm();
    fireEvent.click(screen.getByLabelText('A fee waiver is available'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Waiver status' }), {
      target: { value: 'granted' },
    });
    fireEvent.click(screen.getByLabelText('A fee waiver is available')); // and untick again
    type(/University name/, 'MIT');
    type(/Program name/, 'AI');
    save();
    await screen.findByRole('heading', { level: 1, name: 'MIT' });
    expect(fake.api.create.mock.calls[0]![0].application).toMatchObject({
      fee_waiver_available: false,
      fee_waiver_status: 'not_requested',
    });
  });

  describe('universities you already track', () => {
    const known = () => [
      fakeRecord({
        program_name: 'Computer Science',
        university: {
          id: 'stanford',
          name: 'Stanford University',
          city: 'Stanford',
          region: 'CA',
          country: 'United States',
          website_url: 'https://www.stanford.edu',
        },
      }),
    ];

    it('suggests them by name', async () => {
      await openNewForm(known());
      await waitFor(() => {
        const list = document.querySelector('datalist');
        expect(list?.querySelector('option[value="Stanford University"]')).not.toBeNull();
      });
    });

    it('fills in their details, without touching anything you already typed', async () => {
      await openNewForm(known());
      await waitFor(() =>
        expect(document.querySelector('option[value="Stanford University"]')).not.toBeNull(),
      );
      type('Country', 'USA'); // typed before choosing the university
      type(/University name/, 'stanford university');
      expect(field('City')).toHaveValue('Stanford');
      expect(field('State or region')).toHaveValue('CA');
      expect(field('University website')).toHaveValue('https://www.stanford.edu');
      expect(field('Country')).toHaveValue('USA');
    });

    it('suggests countries from your other programs and common destinations', async () => {
      await openNewForm(known());
      await waitFor(() => {
        const options = Array.from(document.querySelectorAll('datalist option'), (o) =>
          o.getAttribute('value'),
        );
        expect(options).toContain('United States');
        expect(options).toContain('Germany');
      });
    });
  });
});

describe('editing a program', () => {
  const record = () =>
    fakeRecord({
      program_name: 'Computer Science',
      degree_type: 'MS',
      status: 'documents_in_progress',
      priority: 'target',
      deadline: daysFromNow(20),
      application_fee: 90.5,
      fee_currency: 'CAD',
      fee_waiver_available: true,
      fee_waiver_status: 'requested',
      notes: 'Ask Prof. Chen.',
      university: { name: 'University of Toronto', city: 'Toronto', country: 'Canada' },
    });

  it('starts from what is saved', async () => {
    const saved = record();
    open(`/app/applications/${saved.id}/edit`, [saved]);
    await screen.findByRole('heading', { level: 1, name: 'Edit program' });
    expect(field(/University name/)).toHaveValue('University of Toronto');
    expect(field('City')).toHaveValue('Toronto');
    expect(field(/Program name/)).toHaveValue('Computer Science');
    expect(field(/^Status/)).toHaveValue('documents_in_progress');
    expect(field('Priority')).toHaveValue('target');
    expect(field('Deadline')).toHaveValue(saved.deadline);
    expect(field('Fee')).toHaveValue('90.5');
    expect(field('Currency')).toHaveValue('CAD');
    expect(field('A fee waiver is available')).toBeChecked();
    expect(field('Waiver status')).toHaveValue('requested');
    expect(field('Notes')).toHaveValue('Ask Prof. Chen.');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/app/applications/${saved.id}`,
    );
  });

  it('saves changes and returns to the program', async () => {
    const saved = record();
    const { fake } = open(`/app/applications/${saved.id}/edit`, [saved]);
    await screen.findByRole('heading', { level: 1, name: 'Edit program' });
    type(/Program name/, 'Data Science');
    type('Fee', '');
    save();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'University of Toronto' }),
    ).toBeInTheDocument();
    expect(screen.getByText('MS Data Science')).toBeInTheDocument();
    expect(fake.api.update).toHaveBeenCalledWith(
      saved.id,
      expect.objectContaining({
        application: expect.objectContaining({
          program_name: 'Data Science',
          application_fee: null,
        }),
      }),
    );
  });

  it('does not change anything when nothing is edited', async () => {
    const saved = record();
    const { fake } = open(`/app/applications/${saved.id}/edit`, [saved]);
    await screen.findByRole('heading', { level: 1, name: 'Edit program' });
    save();
    await screen.findByRole('heading', { level: 1, name: 'University of Toronto' });
    const { application, university } = fake.api.update.mock.calls[0]![1];
    expect(university).toMatchObject({ name: 'University of Toronto', city: 'Toronto' });
    expect(application).toMatchObject({
      program_name: saved.program_name,
      status: saved.status,
      priority: saved.priority,
      deadline: saved.deadline,
      application_fee: 90.5,
      fee_currency: 'CAD',
      fee_waiver_status: 'requested',
      notes: 'Ask Prof. Chen.',
    });
  });

  it('explains when the program no longer exists', async () => {
    open('/app/applications/gone/edit', [record()]);
    expect(
      await screen.findByRole('heading', { level: 1, name: "We couldn't find that program." }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to applications' })).toHaveAttribute(
      'href',
      '/app/applications',
    );
  });

  it('says so if the program was deleted while you were editing', async () => {
    const saved = record();
    const { fake } = open(`/app/applications/${saved.id}/edit`, [saved]);
    fake.api.update.mockRejectedValueOnce(new DataError('not_found'));
    await screen.findByRole('heading', { level: 1, name: 'Edit program' });
    save();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to save application');
    expect(alert).toHaveTextContent('That application no longer exists');
  });

  it('shows the after-you-apply section for a program that was already submitted', async () => {
    const saved = fakeRecord({
      status: 'accepted',
      submitted_on: '2026-11-20',
      decision_deadline: '2027-04-15',
      enrollment_deposit: 500,
    });
    open(`/app/applications/${saved.id}/edit`, [saved]);
    await screen.findByRole('heading', { level: 1, name: 'Edit program' });
    expect(screen.getByRole('heading', { name: 'After you apply' })).toBeInTheDocument();
    expect(field('Submitted on')).toHaveValue('2026-11-20');
    expect(field('Reply by')).toHaveValue('2027-04-15');
    expect(field('Enrollment deposit')).toHaveValue('500');
  });
});

describe('the form is usable with a keyboard and a screen reader', () => {
  it('groups fields under headings and labels every control', async () => {
    await openNewForm();
    for (const heading of ['University', 'Program', 'Application', 'Application fee', 'Notes']) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    const form = document.querySelector('form')!;
    for (const control of within(form).getAllByRole('textbox')) {
      expect(control).toHaveAccessibleName();
    }
    for (const control of within(form).getAllByRole('combobox')) {
      expect(control).toHaveAccessibleName();
    }
  });
});
