import { fireEvent, screen, within } from '@testing-library/react';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { renderApp } from '@/test/renderApp';

function open(records: ReturnType<typeof fakeRecord>[]) {
  const fake = createFakeApplicationsApi(records);
  renderApp('/app', createFakeAuth(fakeSession()).client, { api: fake.api });
  return fake;
}

const stat = (label: string) =>
  within(screen.getByText(label, { selector: 'dt' }).closest('dl')!).getByText(/^\d+$/).textContent;

describe('dashboard', () => {
  it('invites you to add a first program when there are none', async () => {
    open([]);
    expect(
      await screen.findByRole('heading', { name: 'No applications yet.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add program' })).toHaveAttribute(
      'href',
      '/app/applications/new',
    );
    expect(screen.queryByText('Programs')).not.toBeInTheDocument();
  });

  it('counts your own programs by where they stand', async () => {
    open([
      fakeRecord({ status: 'researching' }),
      fakeRecord({ status: 'shortlisted' }),
      fakeRecord({ status: 'documents_in_progress' }),
      fakeRecord({ status: 'submitted' }),
      fakeRecord({ status: 'interview' }),
      fakeRecord({ status: 'accepted' }),
      fakeRecord({ status: 'rejected' }),
      fakeRecord({ status: 'rejected' }),
      fakeRecord({ status: 'withdrawn' }),
    ]);
    expect(await screen.findByText('Programs', { selector: 'dt' })).toBeInTheDocument();
    expect(stat('Programs')).toBe('9');
    expect(stat('Not started')).toBe('2');
    expect(stat('In progress')).toBe('1');
    expect(stat('Submitted')).toBe('1');
    expect(stat('Interviews')).toBe('1');
    expect(stat('Accepted')).toBe('1');
    expect(stat('Waitlisted')).toBe('0');
    expect(stat('Rejected')).toBe('2');
    expect(screen.queryByRole('heading', { name: 'No applications yet.' })).not.toBeInTheDocument();
  });

  it('links to the full list once there is something in it', async () => {
    open([fakeRecord()]);
    expect(await screen.findByRole('link', { name: 'View applications' })).toHaveAttribute(
      'href',
      '/app/applications',
    );
  });

  it('says so, and lets you retry, when the numbers cannot be loaded', async () => {
    const fake = createFakeApplicationsApi([fakeRecord()]);
    fake.api.list.mockRejectedValueOnce(new DataError('network'));
    renderApp('/app', createFakeAuth(fakeSession()).client, { api: fake.api });
    expect(await screen.findByText('Unable to load programs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Programs', { selector: 'dt' })).toBeInTheDocument();
  });
});
