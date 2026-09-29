import { fireEvent, render, screen } from '@testing-library/react';
import { Menu, MenuItem } from './Menu';

function setup(onEdit = vi.fn()) {
  render(
    <Menu
      label="Row actions"
      trigger={(props) => (
        <button type="button" {...props}>
          Actions
        </button>
      )}
    >
      <MenuItem onSelect={onEdit}>Edit</MenuItem>
      <MenuItem>Duplicate</MenuItem>
      <MenuItem checked>Archive</MenuItem>
    </Menu>,
  );
  return { trigger: screen.getByRole('button', { name: 'Actions' }), onEdit };
}

describe('Menu', () => {
  it('opens on click, focuses the first item, and reports expanded state', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Row actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('moves focus with arrow keys, wrapping at both ends', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitemradio', { name: 'Archive' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(screen.getByRole('menuitemradio', { name: 'Archive' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('runs the selected action and closes', () => {
    const { trigger, onEdit } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when clicking outside', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
