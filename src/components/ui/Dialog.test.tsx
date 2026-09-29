import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Dialog';

describe('Modal', () => {
  it('opens as a labelled dialog with its content', () => {
    render(
      <Modal open onClose={() => {}} title="Delete application?" description="Cannot be undone.">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete application?' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleDescription('Cannot be undone.');
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('does not render its content while closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });

  it('asks to close on Escape, the close button, and backdrop clicks', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Title">
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not close when clicking inside the content', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Title">
        <p>Body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores page scrolling after closing', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Title">
        x
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} onClose={() => {}} title="Title">
        x
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
  });
});
