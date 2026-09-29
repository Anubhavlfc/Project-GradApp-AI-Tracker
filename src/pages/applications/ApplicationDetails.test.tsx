import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { DataError } from '@/features/applications/errors';
import { createFakeApplicationsApi, daysFromNow, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { createFakeRequirementsApi, fakeRequirement } from '@/test/fakeRequirementsApi';
import { renderApp } from '@/test/renderApp';

function open(record: ReturnType<typeof fakeRecord>, others: ReturnType<typeof fakeRecord>[] = []) {
  const fake = createFakeApplicationsApi([record, ...others]);
  const view = renderApp(`/app/applications/${record.id}`, createFakeAuth(fakeSession()).client, {
    api: fake.api,
  });
  return { ...view, fake };
}

const full = () =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    school_college: 'School of Engineering',
    department: 'EECS',
    program_length_months: 24,
    is_stem: true,
    program_url: 'https://cs.example.edu/ms',
    portal_url: 'https://apply.example.edu/start',
    status: 'documents_in_progress',
    priority: 'dream',
    deadline: daysFromNow(9),
    priority_deadline: daysFromNow(2),
    application_fee: 125,
    fee_waiver_available: true,
    fee_waiver_status: 'requested',
    notes: 'Ask Prof. Chen about funding.\nEmail admissions in October.',
    university: {
      name: 'Example University',
      city: 'Palo Alto',
      region: 'CA',
      country: 'United States',
      website_url: 'https://www.example.edu',
    },
  });

describe('program details', () => {
  it('shows the program, its deadline and what it costs', async () => {
    open(full());
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Example University' }),
    ).toBeInTheDocument();
    expect(screen.getByText('MS Computer Science')).toBeInTheDocument();

    const deadlines = within(
      screen.getByRole('heading', { name: 'Deadlines' }).closest('div.rounded-lg')! as HTMLElement,
    );
    expect(deadlines.getByText('In 9 days')).toBeInTheDocument();
    expect(deadlines.getByText('Priority deadline')).toBeInTheDocument();

    const program = within(
      screen.getByRole('heading', { name: 'Program' }).closest('div.rounded-lg')! as HTMLElement,
    );
    expect(program.getByText('Palo Alto, CA, United States')).toBeInTheDocument();
    expect(program.getByText("Master's · MS")).toBeInTheDocument();
    expect(program.getByText('EECS')).toBeInTheDocument();
    expect(program.getByText('24 months')).toBeInTheDocument();
    expect(program.getByText('Designated')).toBeInTheDocument();

    const fee = within(
      screen
        .getByRole('heading', { name: 'Application fee' })
        .closest('div.rounded-lg')! as HTMLElement,
    );
    expect(fee.getByText('$125')).toBeInTheDocument();
    expect(fee.getByText('Requested')).toBeInTheDocument();

    expect(screen.getByText(/Ask Prof\. Chen about funding\./)).toBeInTheDocument();
  });

  it('shows the state of the program as badges and a status you can change', async () => {
    open(full());
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    expect(screen.getByText('Reach')).toBeInTheDocument();
    expect(screen.getByText("Master's")).toBeInTheDocument();
    expect(screen.getByText('STEM', { selector: 'span' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Documents In Progress. Change status of Example University, Computer Science',
      }),
    ).toBeInTheDocument();
  });

  it('leaves out what was not filled in, except the deadline', async () => {
    open(fakeRecord({ university: { name: 'Bare University' } }));
    await screen.findByRole('heading', { level: 1, name: 'Bare University' });
    expect(screen.getByText('Deadline')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('No fee recorded.')).toBeInTheDocument();
    for (const label of [
      'Priority deadline',
      'Submitted on',
      'Interview',
      'Application portal',
      'Department',
      'Decision',
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument();
  });

  it('shows the decision once there is one', async () => {
    open(
      fakeRecord({
        status: 'accepted',
        decision_received_on: '2027-03-10',
        decision_deadline: daysFromNow(6),
        enrollment_deposit: 500,
        university: { name: 'Happy University' },
      }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Happy University' });
    const decision = within(
      screen.getByRole('heading', { name: 'Decision' }).closest('div.rounded-lg')! as HTMLElement,
    );
    expect(decision.getByText('Mar 10, 2027')).toBeInTheDocument();
    expect(decision.getByText('In 6 days')).toBeInTheDocument();
    expect(decision.getByText('$500')).toBeInTheDocument();
  });

  it('stops counting down the reply date once you have chosen', async () => {
    open(
      fakeRecord({
        status: 'accepted',
        decision_deadline: daysFromNow(6),
        is_final_choice: true,
        university: { name: 'Chosen University' },
      }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Chosen University' });
    expect(screen.queryByText('In 6 days')).not.toBeInTheDocument();
    expect(screen.getByText('Yes, this is my choice')).toBeInTheDocument();
  });

  describe('links', () => {
    it('open in a new tab that cannot reach back', async () => {
      open(full());
      await screen.findByRole('heading', { level: 1, name: 'Example University' });
      const portal = screen.getByRole('link', { name: /apply\.example\.edu/ });
      expect(portal).toHaveAttribute('href', 'https://apply.example.edu/start');
      expect(portal).toHaveAttribute('target', '_blank');
      expect(portal).toHaveAttribute('rel', 'noopener noreferrer');
      expect(portal).toHaveAccessibleName(/opens in a new tab/);
      expect(screen.getByRole('link', { name: /^example\.edu/ })).toHaveAttribute(
        'href',
        'https://www.example.edu',
      );
    });

    it('are never made from anything but http(s), even if bad data got into the database', async () => {
      open(
        fakeRecord({
          portal_url: 'javascript:alert(document.cookie)',
          program_url: 'data:text/html,<script>alert(1)</script>',
          university: { name: 'Tampered University', website_url: 'vbscript:msgbox(1)' },
        }),
      );
      await screen.findByRole('heading', { level: 1, name: 'Tampered University' });
      const hrefs = screen.queryAllByRole('link').map((link) => link.getAttribute('href') ?? '');
      expect(hrefs.filter((href) => /^(javascript|data|vbscript):/i.test(href))).toEqual([]);
    });
  });

  describe('actions', () => {
    it('changes the status from the header', async () => {
      const { fake } = open(full());
      await screen.findByRole('heading', { level: 1, name: 'Example University' });
      fireEvent.click(screen.getByRole('button', { name: /Change status of Example University/ }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ready to Submit' }));
      expect(await screen.findByRole('button', { name: /^Ready to Submit\./ })).toBeInTheDocument();
      expect(fake.api.setStatus).toHaveBeenCalledWith(
        fake.records[0]!.id,
        'ready_to_submit',
        undefined,
      );
    });

    it('stars the program', async () => {
      const { fake } = open(full());
      const star = await screen.findByRole('button', {
        name: 'Favorite Example University, Computer Science',
      });
      fireEvent.click(star);
      await waitFor(() => expect(star).toHaveAttribute('aria-pressed', 'true'));
      expect(fake.api.setFavorite).toHaveBeenCalledWith(fake.records[0]!.id, true);
    });

    it('links to the edit form', async () => {
      const record = full();
      open(record);
      expect(await screen.findByRole('link', { name: 'Edit' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/edit`,
      );
    });

    it('deletes after confirmation and returns to the list with a note', async () => {
      const other = fakeRecord({ university: { name: 'Another University' } });
      const { fake } = open(full(), [other]);
      await screen.findByRole('heading', { level: 1, name: 'Example University' });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Applications' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Deleted Example University, Computer Science.')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Example University' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Another University' })).toBeInTheDocument();
      expect(fake.records.map((r) => r.university.name)).toEqual(['Another University']);
    });

    it('stays on the page if deleting fails', async () => {
      const { fake } = open(full());
      fake.api.remove.mockRejectedValueOnce(new DataError('session'));
      await screen.findByRole('heading', { level: 1, name: 'Example University' });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      expect(
        await within(dialog).findByText("Couldn't delete this application"),
      ).toBeInTheDocument();
      expect(dialog).toHaveTextContent('Your session expired. Sign in again.');
      expect(
        screen.getByRole('heading', { level: 1, name: 'Example University' }),
      ).toBeInTheDocument();
    });
  });

  it('explains when there is no such program', async () => {
    const fake = createFakeApplicationsApi([fakeRecord()]);
    renderApp('/app/applications/does-not-exist', createFakeAuth(fakeSession()).client, {
      api: fake.api,
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: "We couldn't find that program." }),
    ).toBeInTheDocument();
  });

  it('offers to retry when the program cannot be loaded', async () => {
    const record = full();
    const fake = createFakeApplicationsApi([record]);
    fake.api.list.mockRejectedValueOnce(new DataError('network'));
    renderApp(`/app/applications/${record.id}`, createFakeAuth(fakeSession()).client, {
      api: fake.api,
    });
    expect(await screen.findByText('Unable to load this program')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Example University' }),
    ).toBeInTheDocument();
  });

  it('has a tab for each section of the program', async () => {
    open(full());
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    const tabs = within(
      screen.getByRole('navigation', { name: 'Sections of this program' }),
    ).getAllByRole('link');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Requirements']);
  });

  it('links back to the list', async () => {
    open(full());
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Applications' }),
    ).toHaveAttribute('href', '/app/applications');
  });
});

describe('requirements on the overview', () => {
  function openWith(items: Parameters<typeof fakeRequirement>[0][], record = full()) {
    const checklist = createFakeRequirementsApi(
      items.map((item) => fakeRequirement({ application_id: record.id, ...item })),
    );
    renderApp(`/app/applications/${record.id}`, createFakeAuth(fakeSession()).client, {
      api: createFakeApplicationsApi([record]).api,
      requirementsApi: checklist.api,
    });
    return { record, checklist };
  }
  const card = () =>
    within(
      screen
        .getByRole('heading', { name: 'Requirements' })
        .closest('div.rounded-lg')! as HTMLElement,
    );

  it('shows how far along the checklist is, with a way in', async () => {
    const { record } = openWith([
      { kind: 'resume_cv', status: 'complete' },
      { kind: 'transcript', status: 'in_progress' },
      { kind: 'gre' },
      { kind: 'portfolio', is_required: false },
    ]);
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    expect(await card().findByText('1 of 3')).toBeInTheDocument();
    expect(card().getByText('33%')).toBeInTheDocument();
    expect(card().getByText('1 in progress · 1 not started · 1 optional')).toBeInTheDocument();
    expect(card().getByRole('link', { name: 'View checklist' })).toHaveAttribute(
      'href',
      `/app/applications/${record.id}/requirements`,
    );
  });

  it('invites you to start a checklist when there is none', async () => {
    const { record } = openWith([]);
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    expect(await card().findByText('No requirements yet.')).toBeInTheDocument();
    expect(card().getByRole('link', { name: 'Add requirements' })).toHaveAttribute(
      'href',
      `/app/applications/${record.id}/requirements`,
    );
  });

  it('does not count another program’s items', async () => {
    openWith([{ kind: 'resume_cv', application_id: 'somewhere-else', status: 'complete' }]);
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    expect(await card().findByText('No requirements yet.')).toBeInTheDocument();
  });

  it('says so, and lets you try again, when the checklist cannot be loaded', async () => {
    const { checklist } = openWith([{ kind: 'resume_cv', status: 'complete' }]);
    checklist.api.list.mockRejectedValueOnce(new DataError('network'));
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    expect(await card().findByText('Unable to load requirements')).toBeInTheDocument();
    expect(card().getByText(/Can't reach the server/)).toBeInTheDocument();
    // The rest of the page is not held up by it.
    expect(screen.getByRole('heading', { name: 'Deadlines' })).toBeInTheDocument();
    fireEvent.click(card().getByRole('button', { name: 'Try again' }));
    expect(await card().findByText('1 of 1')).toBeInTheDocument();
  });

  it('opens the checklist from the card', async () => {
    openWith([{ kind: 'resume_cv' }]);
    await screen.findByRole('heading', { level: 1, name: 'Example University' });
    fireEvent.click(await card().findByRole('link', { name: 'View checklist' }));
    expect(await screen.findByRole('list', { name: 'Requirements' })).toBeInTheDocument();
  });
});
