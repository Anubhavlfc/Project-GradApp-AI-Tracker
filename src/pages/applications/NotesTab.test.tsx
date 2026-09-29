import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { NOTES_MAX } from '@/features/applications/notes';
import type { ApplicationRecord } from '@/features/applications/types';
import { DataError } from '@/lib/dataError';
import { createFakeApplicationsApi, fakeRecord } from '@/test/fakeApplicationsApi';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { renderApp } from '@/test/renderApp';

const stanford = (overrides: Parameters<typeof fakeRecord>[0] = {}) =>
  fakeRecord({
    program_name: 'Computer Science',
    degree_type: 'MS',
    status: 'documents_in_progress',
    university: { name: 'Stanford University' },
    ...overrides,
  });

/** Opens one program's Notes tab (or another tab, with `path`). */
function open({
  record = stanford(),
  path = 'notes',
}: { record?: ReturnType<typeof stanford>; path?: string } = {}) {
  const applications = createFakeApplicationsApi([record]);
  const view = renderApp(
    `/app/applications/${record.id}/${path}`,
    createFakeAuth(fakeSession()).client,
    { api: applications.api },
  );
  return { ...view, record, applications };
}

const box = () =>
  screen.findByRole('textbox', {
    name: 'Notes for Stanford University, Computer Science',
  }) as Promise<HTMLTextAreaElement>;
const type = (textbox: HTMLElement, value: string) =>
  fireEvent.change(textbox, { target: { value } });
const save = () => screen.getByRole('button', { name: 'Save notes' });
const status = () => screen.getByRole('status', { name: '' });

const tabs = () => screen.getByRole('navigation', { name: 'Sections of this program' });
const goToTab = (name: string) => fireEvent.click(within(tabs()).getByRole('link', { name }));
const goToPage = (name: string) =>
  fireEvent.click(
    within(screen.getAllByRole('navigation', { name: 'Primary' })[0]!).getByRole('link', { name }),
  );
/** Waits until the notes box is gone (another tab or page has taken its place). */
const boxGone = () =>
  waitFor(() =>
    expect(screen.queryByRole('textbox', { name: /^Notes for / })).not.toBeInTheDocument(),
  );

/** Whether leaving the page now would ask first. */
function leavingIsBlocked(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('a program’s notes tab', () => {
  describe('getting there', () => {
    it('is a tab on the program page', async () => {
      const { record } = open({ path: '' });
      const tabs = await screen.findByRole('navigation', { name: 'Sections of this program' });
      fireEvent.click(within(tabs).getByRole('link', { name: 'Notes' }));
      await box();
      expect(within(tabs).getByRole('link', { name: 'Notes' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(tabs).getByRole('link', { name: 'Notes' })).toHaveAttribute(
        'href',
        `/app/applications/${record.id}/notes`,
      );
    });

    it('is reached from the notes on the overview', async () => {
      const { record } = open({ record: stanford({ notes: 'Ask about funding.' }), path: '' });
      const link = await screen.findByRole('link', { name: 'Edit notes' });
      expect(link).toHaveAttribute('href', `/app/applications/${record.id}/notes`);
      fireEvent.click(link);
      expect(await box()).toHaveValue('Ask about funding.');
    });
  });

  describe('the box', () => {
    it('shows the notes already saved, and counts them', async () => {
      open({ record: stanford({ notes: 'Ask Dr. Lee about funding.' }) });
      expect(await box()).toHaveValue('Ask Dr. Lee about funding.');
      expect(screen.getByText('26 of 10,000 characters')).toBeVisible();
    });

    it('is empty when there are none, and nothing can be saved yet', async () => {
      open();
      expect(await box()).toHaveValue('');
      expect(screen.getByText('0 of 10,000 characters')).toBeVisible();
      expect(save()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();
      expect(status()).toHaveTextContent('');
    });

    it('describes itself to a screen reader with the character count', async () => {
      open();
      const textbox = await box();
      const hint = document.getElementById(textbox.getAttribute('aria-describedby')!);
      expect(hint).toHaveTextContent('0 of 10,000 characters');
    });
  });

  describe('typing and saving', () => {
    it('lets you save once you have typed something, and says there is more to save', async () => {
      open();
      const textbox = await box();
      type(textbox, 'Deadline moved to January.');
      expect(save()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Discard changes' })).toBeVisible();
      expect(status()).toHaveTextContent('Unsaved changes');
      expect(screen.getByText('26 of 10,000 characters')).toBeVisible();
    });

    it('saves what was typed, tidied, and then says it is saved', async () => {
      const { applications, record } = open();
      const textbox = await box();
      type(textbox, '  First line\r\n\r\nSecond line  \n');
      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(applications.api.setNotes).toHaveBeenCalledTimes(1);
      expect(applications.api.setNotes).toHaveBeenCalledWith(
        record.id,
        'First line\n\nSecond line',
      );
      // The box now shows what is stored, and there is nothing more to save.
      expect(textbox).toHaveValue('First line\n\nSecond line');
      expect(save()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();
    });

    it('clears the notes when the box is emptied', async () => {
      const { applications, record } = open({ record: stanford({ notes: 'Old notes' }) });
      const textbox = await box();
      type(textbox, '   ');
      expect(status()).toHaveTextContent('Unsaved changes');
      fireEvent.click(save());
      await waitFor(() => expect(applications.api.setNotes).toHaveBeenCalledWith(record.id, null));
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(textbox).toHaveValue('');
    });

    it('treats the same text in different spacing as no change', async () => {
      open({ record: stanford({ notes: 'Same' }) });
      const textbox = await box();
      type(textbox, '  Same \n');
      expect(save()).toBeDisabled();
      expect(status()).toHaveTextContent('');
      expect(screen.queryByRole('button', { name: 'Discard changes' })).not.toBeInTheDocument();
    });

    it('shows the saved notes on the overview', async () => {
      open();
      const textbox = await box();
      type(textbox, 'Remember the portal password.');
      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      const tabs = screen.getByRole('navigation', { name: 'Sections of this program' });
      fireEvent.click(within(tabs).getByRole('link', { name: 'Overview' }));
      expect(await screen.findByText('Remember the portal password.')).toBeVisible();
    });

    it('sends nothing when the form is submitted with nothing to save', async () => {
      const { applications } = open({ record: stanford({ notes: 'Same' }) });
      const textbox = await box();
      fireEvent.submit(textbox.closest('form')!);
      type(textbox, ' Same ');
      fireEvent.submit(textbox.closest('form')!);
      expect(applications.api.setNotes).not.toHaveBeenCalled();
    });

    it('stops saying "Saved." as soon as you type again, even when the text is the same', async () => {
      open();
      const textbox = await box();
      type(textbox, 'One');
      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      // Only the spacing differs, so there is nothing to save, and nothing to celebrate either.
      type(textbox, 'One ');
      expect(status()).toHaveTextContent('');
    });

    it('clears the saved message as soon as you type again', async () => {
      open();
      const textbox = await box();
      type(textbox, 'One');
      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      type(textbox, 'One two');
      expect(status()).toHaveTextContent('Unsaved changes');
      expect(status()).not.toHaveTextContent('Saved.');
    });
  });

  describe('discarding', () => {
    it('puts back what is saved', async () => {
      open({ record: stanford({ notes: 'Saved notes' }) });
      const textbox = await box();
      type(textbox, 'Something else entirely');
      fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
      expect(textbox).toHaveValue('Saved notes');
      expect(save()).toBeDisabled();
      expect(status()).toHaveTextContent('');
    });
  });

  describe('too much text', () => {
    it('allows exactly the limit', async () => {
      open();
      const textbox = await box();
      type(textbox, 'x'.repeat(NOTES_MAX));
      expect(screen.getByText('10,000 of 10,000 characters')).toBeVisible();
      expect(save()).toBeEnabled();
      expect(textbox).not.toHaveAttribute('aria-invalid');
    });

    it('turns the count red only when there is too much', async () => {
      open();
      const textbox = await box();
      type(textbox, 'x'.repeat(NOTES_MAX));
      expect(screen.getByText('10,000 of 10,000 characters')).not.toHaveClass('text-tone-red-fg');
      type(textbox, 'x'.repeat(NOTES_MAX + 1));
      expect(screen.getByText('Notes must be 10000 characters or fewer.')).toHaveClass(
        'text-tone-red-fg',
      );
    });

    it('explains one character too many, and does not let you save', async () => {
      const { applications } = open();
      const textbox = await box();
      type(textbox, 'x'.repeat(NOTES_MAX + 1));
      expect(screen.getByText('Notes must be 10000 characters or fewer.')).toBeVisible();
      expect(textbox).toHaveAttribute('aria-invalid', 'true');
      expect(save()).toBeDisabled();
      fireEvent.submit(textbox.closest('form')!);
      expect(applications.api.setNotes).not.toHaveBeenCalled();
      // Removing the extra character makes it fine again.
      type(textbox, 'x'.repeat(NOTES_MAX));
      expect(save()).toBeEnabled();
    });
  });

  describe('when saving fails', () => {
    it('says why, keeps what you typed, and lets you try again', async () => {
      const { applications, record } = open();
      applications.api.setNotes.mockRejectedValueOnce(new DataError('network'));
      const textbox = await box();
      type(textbox, 'Important notes');
      fireEvent.click(save());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("Couldn't save your notes");
      expect(alert).toHaveTextContent("Can't reach the server");
      expect(alert).toHaveTextContent('What you typed is still in the box.');
      expect(textbox).toHaveValue('Important notes');
      expect(status()).toHaveTextContent('Unsaved changes');

      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(applications.api.setNotes).toHaveBeenLastCalledWith(record.id, 'Important notes');
    });

    it('lets you dismiss the message', async () => {
      const { applications } = open();
      applications.api.setNotes.mockRejectedValueOnce(new DataError('network'));
      type(await box(), 'Text');
      fireEvent.click(save());
      const alert = await screen.findByRole('alert');
      fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says so when the program was deleted in the meantime', async () => {
      const { applications } = open();
      applications.api.setNotes.mockRejectedValueOnce(new DataError('not_found'));
      type(await box(), 'Text');
      fireEvent.click(save());
      expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/);
    });

    it('does not take typing while the save is on its way, since it would be lost', async () => {
      const { applications } = open();
      let finish = () => {};
      applications.api.setNotes.mockImplementationOnce(
        (id, notes) =>
          new Promise((resolve) => {
            finish = () => resolve({ ...applications.records.find((r) => r.id === id)!, notes });
          }),
      );
      const textbox = await box();
      type(textbox, 'Text');
      expect(textbox).not.toHaveAttribute('readonly');
      fireEvent.click(save());
      await waitFor(() => expect(textbox).toHaveAttribute('readonly'));
      await act(async () => finish());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(textbox).not.toHaveAttribute('readonly');
    });

    it('cannot send twice while saving', async () => {
      const { applications } = open();
      let finish = () => {};
      applications.api.setNotes.mockImplementationOnce(
        (id, notes) =>
          new Promise((resolve) => {
            finish = () => resolve({ ...applications.records.find((r) => r.id === id)!, notes });
          }),
      );
      const textbox = await box();
      type(textbox, 'Text');
      fireEvent.click(save());
      await waitFor(() => expect(applications.api.setNotes).toHaveBeenCalledTimes(1));
      // Still waiting for the first: pressing Enter in a form, or the button again, sends nothing.
      fireEvent.submit(textbox.closest('form')!);
      fireEvent.click(save());
      expect(applications.api.setNotes).toHaveBeenCalledTimes(1);
      await act(async () => finish());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(applications.api.setNotes).toHaveBeenCalledTimes(1);
    });
  });

  describe('leaving the page', () => {
    it('asks first while there are changes that are not saved', async () => {
      open();
      const textbox = await box();
      expect(leavingIsBlocked()).toBe(false);
      type(textbox, 'Unsaved');
      expect(leavingIsBlocked()).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
      expect(leavingIsBlocked()).toBe(false);
    });

    it('stops asking once the notes are saved', async () => {
      open();
      type(await box(), 'Unsaved');
      expect(leavingIsBlocked()).toBe(true);
      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(leavingIsBlocked()).toBe(false);
    });

    it('does not ask when the text only differs in spacing', async () => {
      open({ record: stanford({ notes: 'Same' }) });
      type(await box(), 'Same  ');
      expect(leavingIsBlocked()).toBe(false);
    });

    it('stops asking when the app is closed', async () => {
      const { unmount } = open();
      type(await box(), 'Unsaved');
      expect(leavingIsBlocked()).toBe(true);
      unmount();
      expect(leavingIsBlocked()).toBe(false);
    });
  });

  describe('moving around the app', () => {
    it('keeps what you typed while you visit another tab of the program, and gives it back', async () => {
      open({ record: stanford({ notes: 'Saved' }) });
      type(await box(), 'Saved, and more');

      goToTab('Overview');
      await boxGone();
      expect(leavingIsBlocked()).toBe(true);

      goToTab('Notes');
      const textbox = await box();
      expect(textbox).toHaveValue('Saved, and more');
      expect(status()).toHaveTextContent('Unsaved changes');
      expect(save()).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Discard changes' })).toBeVisible();
    });

    it('keeps it while you visit other pages of the app too', async () => {
      open({ record: stanford({ notes: 'Saved' }) });
      type(await box(), 'Saved, and more');

      goToPage('Deadlines');
      expect(await screen.findByRole('heading', { name: 'Deadlines' })).toBeVisible();
      expect(leavingIsBlocked()).toBe(true);

      goToPage('Applications');
      fireEvent.click(await screen.findByRole('link', { name: 'Stanford University' }));
      await screen.findByRole('navigation', { name: 'Sections of this program' });
      goToTab('Notes');
      expect(await box()).toHaveValue('Saved, and more');
    });

    it('keeps it apart for each program', async () => {
      const first = stanford({ notes: 'Stanford notes' });
      const second = stanford({
        program_name: 'Robotics',
        university: { name: 'MIT' },
        notes: 'MIT notes',
      });
      const applications = createFakeApplicationsApi([first, second]);
      renderApp(`/app/applications/${first.id}/notes`, createFakeAuth(fakeSession()).client, {
        api: applications.api,
      });
      type(await box(), 'Half a thought about Stanford');

      // The other program shows what it has saved, and the first draft is still held.
      goToPage('Applications');
      fireEvent.click(await screen.findByRole('link', { name: 'MIT' }));
      await screen.findByRole('navigation', { name: 'Sections of this program' });
      goToTab('Notes');
      const mit = await screen.findByRole('textbox', { name: 'Notes for MIT, Robotics' });
      expect(mit).toHaveValue('MIT notes');
      expect(status()).toHaveTextContent('');
      expect(leavingIsBlocked()).toBe(true);

      // Typing here does not lose the first one.
      type(mit, 'A thought about MIT');
      goToPage('Applications');
      fireEvent.click(await screen.findByRole('link', { name: 'Stanford University' }));
      await screen.findByRole('navigation', { name: 'Sections of this program' });
      goToTab('Notes');
      expect(await box()).toHaveValue('Half a thought about Stanford');
    });

    it('starts from what is saved once the notes are saved', async () => {
      open({ record: stanford({ notes: 'Before' }) });
      type(await box(), 'After');
      fireEvent.click(save());
      await waitFor(() => expect(status()).toHaveTextContent('Saved.'));
      expect(leavingIsBlocked()).toBe(false);

      goToTab('Overview');
      await boxGone();
      goToTab('Notes');
      expect(await box()).toHaveValue('After');
      expect(status()).toHaveTextContent('');
      expect(leavingIsBlocked()).toBe(false);
    });

    it('lets go of it when the changes are discarded', async () => {
      open({ record: stanford({ notes: 'Saved' }) });
      type(await box(), 'Not wanted');
      fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
      expect(leavingIsBlocked()).toBe(false);

      goToTab('Overview');
      await boxGone();
      goToTab('Notes');
      expect(await box()).toHaveValue('Saved');
    });

    it('lets go of it when the text is put back to what is saved', async () => {
      open({ record: stanford({ notes: 'Saved' }) });
      const textbox = await box();
      type(textbox, 'Saved, and more');
      type(textbox, 'Saved');
      expect(leavingIsBlocked()).toBe(false);

      goToTab('Overview');
      await boxGone();
      goToTab('Notes');
      expect(await box()).toHaveValue('Saved');
    });

    it('keeps a save that failed, since nothing was saved', async () => {
      const { applications } = open();
      applications.api.setNotes.mockRejectedValueOnce(new DataError('network'));
      type(await box(), 'Important');
      fireEvent.click(save());
      await screen.findByRole('alert');
      expect(leavingIsBlocked()).toBe(true);

      goToTab('Overview');
      await boxGone();
      goToTab('Notes');
      expect(await box()).toHaveValue('Important');
    });

    it('lets go of it when the program is deleted', async () => {
      const { applications } = open();
      type(await box(), 'Never saved');
      expect(leavingIsBlocked()).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
      await waitFor(() => expect(applications.api.remove).toHaveBeenCalled());
      await boxGone();
      expect(leavingIsBlocked()).toBe(false);
    });
  });

  describe('changes made elsewhere', () => {
    const cachedKey = ['applications', 'user-1'];

    it('shows up in the box while you have not started typing', async () => {
      const { queryClient, record } = open({ record: stanford({ notes: 'Before' }) });
      const textbox = await box();
      await act(async () => {
        queryClient.setQueryData<ApplicationRecord[]>(cachedKey, (old) =>
          old?.map((item) =>
            item.id === record.id ? { ...item, notes: 'Changed elsewhere' } : item,
          ),
        );
      });
      await waitFor(() => expect(textbox).toHaveValue('Changed elsewhere'));
    });

    it('does not replace what you are typing', async () => {
      const { queryClient, record } = open({ record: stanford({ notes: 'Before' }) });
      const textbox = await box();
      type(textbox, 'Half-written thought');
      await act(async () => {
        queryClient.setQueryData<ApplicationRecord[]>(cachedKey, (old) =>
          old?.map((item) =>
            item.id === record.id ? { ...item, notes: 'Changed elsewhere' } : item,
          ),
        );
      });
      expect(textbox).toHaveValue('Half-written thought');
    });
  });
});
