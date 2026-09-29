import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataError } from '@/lib/dataError';
import { authError, createFakeAuth, fakeSession, fakeUser } from '@/test/fakeAuth';
import { createFakeSettingsApi, fakeAccountData } from '@/test/fakeSettingsApi';
import { renderApp } from '@/test/renderApp';

function open(options: { email?: string; data?: ReturnType<typeof fakeAccountData> } = {}) {
  const auth = createFakeAuth(fakeSession(fakeUser({ email: options.email ?? 'ada@example.com' })));
  const settings = createFakeSettingsApi(options.data);
  const view = renderApp('/app/settings', auth.client, { settingsApi: settings.api });
  return { ...view, auth, settings: settings.api };
}

/** Sets what is in a box, as if it had been typed. */
const write = (field: HTMLElement, value: string) => fireEvent.change(field, { target: { value } });

const card = async (title: string) => {
  const heading = await screen.findByRole('heading', { level: 2, name: title });
  return heading.closest('div.rounded-lg') as HTMLElement;
};

describe('the Settings page', () => {
  it('is in the menu, at the end, and marked as the current page', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const link = screen.getAllByRole('link', { name: 'Settings' })[0];
    expect(link).toHaveAttribute('href', '/app/settings');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('shows the email address of the signed-in account', async () => {
    open({ email: 'grace@example.com' });
    const account = within(await card('Account'));
    expect(account.getByText('grace@example.com')).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('signs out and returns to the sign-in page', async () => {
    const { auth } = open();
    fireEvent.click(within(await card('Account')).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(auth.client.signOut).toHaveBeenCalledTimes(1);
  });

  it('says so, and stays signed in, when signing out fails', async () => {
    const { auth } = open();
    auth.client.signOut.mockResolvedValueOnce({ error: authError('unexpected_failure') });
    fireEvent.click(within(await card('Account')).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't sign out");
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });
});

describe('changing the password', () => {
  const fill = async (password: string, confirm = password) => {
    const password_ = within(await card('Password'));
    write(password_.getByLabelText('New password'), password);
    write(password_.getByLabelText('Confirm new password'), confirm);
    return password_;
  };

  it('saves the new password and empties the form', async () => {
    const { auth } = open();
    const form = await fill('a-long-new-password');
    fireEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(await form.findByText('Your password was changed.')).toBeInTheDocument();
    expect(auth.client.updateUser).toHaveBeenCalledWith({ password: 'a-long-new-password' });
    expect(form.getByLabelText('New password')).toHaveValue('');
    expect(form.getByLabelText('Confirm new password')).toHaveValue('');
  });

  it('withdraws the success message as soon as the person starts typing again', async () => {
    open();
    const form = await fill('a-long-new-password');
    fireEvent.click(form.getByRole('button', { name: 'Change password' }));
    await form.findByText('Your password was changed.');
    write(form.getByLabelText('New password'), 'x');
    expect(form.queryByText('Your password was changed.')).not.toBeInTheDocument();
  });

  it('refuses a short password without asking the server', async () => {
    const { auth } = open();
    const form = await fill('short');
    fireEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(await form.findByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(auth.client.updateUser).not.toHaveBeenCalled();
  });

  it('refuses two different passwords', async () => {
    const { auth } = open();
    const form = await fill('a-long-new-password', 'another-long-password');
    fireEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(await form.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(auth.client.updateUser).not.toHaveBeenCalled();
  });

  it('explains what the server refused, in plain words', async () => {
    const { auth } = open();
    auth.client.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: authError('same_password'),
    });
    const form = await fill('a-long-new-password');
    fireEvent.click(form.getByRole('button', { name: 'Change password' }));
    expect(
      await form.findByText('Your new password must be different from your current one.'),
    ).toBeInTheDocument();
    // What was typed stays, so the person can fix it.
    expect(form.getByLabelText('New password')).toHaveValue('a-long-new-password');
  });
});

describe('appearance', () => {
  it('switches the theme and remembers it on this device', async () => {
    open();
    const select = within(await card('Appearance')).getByLabelText('Theme');
    expect(select).toHaveValue('system');
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
    fireEvent.change(select, { target: { value: 'light' } });
    expect(document.documentElement).not.toHaveClass('dark');
    expect(select).toHaveValue('light');
  });
});

describe('downloading my data', () => {
  let blobs: Blob[];
  let clicked: string[];

  beforeEach(() => {
    blobs = [];
    clicked = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return 'blob:download';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads everything and offers it as a file, with the email and the rows in it', async () => {
    const data = fakeAccountData({
      tasks: [{ id: 't1', title: 'Order transcripts', status: 'todo' }],
    });
    const { settings } = open({ email: 'grace@example.com', data });
    fireEvent.click(
      within(await card('Your data')).getByRole('button', { name: 'Download my data' }),
    );
    expect(await screen.findByText('Your file was downloaded.')).toBeInTheDocument();
    expect(settings.exportData).toHaveBeenCalledTimes(1);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatch(/^application-command-center-data-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(await blobs[0]!.text());
    expect(file.account).toEqual({ email: 'grace@example.com' });
    expect(file.data.tasks).toEqual([{ id: 't1', title: 'Order transcripts', status: 'todo' }]);
    expect(Object.keys(file.data)).toHaveLength(10);
  });

  it('says so, and offers no file, when the data cannot be read', async () => {
    const { settings } = open();
    settings.exportData.mockRejectedValueOnce(new DataError('network'));
    fireEvent.click(
      within(await card('Your data')).getByRole('button', { name: 'Download my data' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't prepare your file");
    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
    expect(clicked).toHaveLength(0);
    expect(screen.queryByText('Your file was downloaded.')).not.toBeInTheDocument();
  });

  it('can be tried again after a failure', async () => {
    const { settings } = open();
    settings.exportData.mockRejectedValueOnce(new DataError('network'));
    const button = within(await card('Your data')).getByRole('button', {
      name: 'Download my data',
    });
    fireEvent.click(button);
    await screen.findByRole('alert');
    fireEvent.click(button);
    expect(await screen.findByText('Your file was downloaded.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('deleting the account', () => {
  const openDialog = async () => {
    fireEvent.click(
      within(await card('Delete account')).getByRole('button', { name: 'Delete account…' }),
    );
    return screen.findByRole('dialog', { name: 'Delete your account?' });
  };
  const confirmButton = (dialog: HTMLElement) =>
    within(dialog).getByRole('button', { name: 'Delete account and data' });

  it('asks first, names the account, and deletes nothing yet', async () => {
    const { settings } = open({ email: 'ada@example.com' });
    const dialog = await openDialog();
    expect(dialog).toHaveTextContent('permanently deletes ada@example.com');
    expect(dialog).toHaveTextContent("can't be undone");
    expect(confirmButton(dialog)).toBeDisabled();
    expect(settings.deleteAccount).not.toHaveBeenCalled();
  });

  it('keeps the button disabled until the email address has been typed', async () => {
    open({ email: 'ada@example.com' });
    const dialog = await openDialog();
    const box = within(dialog).getByLabelText('Type your email address to confirm');
    write(box, 'ada@example');
    expect(confirmButton(dialog)).toBeDisabled();
    write(box, 'ada@example.org');
    expect(confirmButton(dialog)).toBeDisabled();
    write(box, '  ADA@example.com ');
    expect(confirmButton(dialog)).toBeEnabled();
  });

  it('closes on Cancel without deleting, and asks again from scratch next time', async () => {
    const { settings } = open();
    let dialog = await openDialog();
    write(within(dialog).getByLabelText('Type your email address to confirm'), 'ada@example.com');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Delete your account?' })).not.toBeInTheDocument();
    dialog = await openDialog();
    expect(within(dialog).getByLabelText('Type your email address to confirm')).toHaveValue('');
    expect(settings.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account, forgets the sign-in on this device, and says so on the sign-in page', async () => {
    const { settings, auth } = open({ email: 'ada@example.com' });
    const dialog = await openDialog();
    write(within(dialog).getByLabelText('Type your email address to confirm'), 'ada@example.com');
    fireEvent.click(confirmButton(dialog));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(await screen.findByText('Your account has been deleted.')).toBeInTheDocument();
    expect(settings.deleteAccount).toHaveBeenCalledTimes(1);
    expect(auth.client.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(auth.session).toBeNull();
  });

  it('can be submitted from the keyboard, since the button belongs to the form', async () => {
    const { settings } = open({ email: 'ada@example.com' });
    const dialog = await openDialog();
    const box = within(dialog).getByLabelText('Type your email address to confirm');
    write(box, 'ada@example.com');
    expect(confirmButton(dialog)).toHaveAttribute('form', box.closest('form')?.id);
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    await waitFor(() => expect(settings.deleteAccount).toHaveBeenCalledTimes(1));
  });

  it('does not delete on Enter before the address matches', async () => {
    const { settings } = open({ email: 'ada@example.com' });
    const dialog = await openDialog();
    const box = within(dialog).getByLabelText('Type your email address to confirm');
    write(box, 'nope');
    fireEvent.submit(box.closest('form') as HTMLFormElement);
    expect(settings.deleteAccount).not.toHaveBeenCalled();
  });

  it('stays signed in, and says nothing was deleted, when the deletion fails', async () => {
    const { settings, auth } = open({ email: 'ada@example.com' });
    settings.deleteAccount.mockRejectedValueOnce(new DataError('network'));
    const dialog = await openDialog();
    write(within(dialog).getByLabelText('Type your email address to confirm'), 'ada@example.com');
    fireEvent.click(confirmButton(dialog));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't delete your account");
    expect(alert).toHaveTextContent('Nothing was deleted.');
    expect(auth.client.signOut).not.toHaveBeenCalled();
    expect(auth.session).not.toBeNull();
    // Still there to try again.
    expect(confirmButton(dialog)).toBeEnabled();
  });
});
