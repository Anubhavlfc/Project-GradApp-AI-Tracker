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
      <MenuItem checked={false}>Archive</MenuItem>
    </Menu>,
  );
  return { trigger: screen.getByRole('button', { name: 'Actions' }), onEdit };
}

describe('Menu', () => {
  it('opens on click and reports expanded state', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('focuses the first item when nothing is selected', () => {
    render(
      <Menu
        label="Actions"
        trigger={(props) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      >
        <MenuItem>Edit</MenuItem>
        <MenuItem>Delete</MenuItem>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('starts on the selected item of a radio-style menu', () => {
    render(
      <Menu
        label="Pick one"
        trigger={(props) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      >
        <MenuItem checked={false}>One</MenuItem>
        <MenuItem checked>Two</MenuItem>
        <MenuItem checked={false}>Three</MenuItem>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('menuitemradio', { name: 'Two' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemradio', { name: 'Three' })).toHaveFocus();
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

  it('never scrolls the page when it moves focus, which would close the menu', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      const { trigger } = setup();
      fireEvent.click(trigger);
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' });
      const forItems = focus.mock.calls.filter((call) => call[0] !== undefined);
      expect(forItems).toHaveLength(3);
      expect(forItems.every(([options]) => options?.preventScroll === true)).toBe(true);
    } finally {
      focus.mockRestore();
    }
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

  it('closes when scrolling moves its button, but not when the button stays put', () => {
    const { trigger } = setup();
    const rectAt = (top: number) => ({
      top,
      left: 50,
      bottom: top + 30,
      right: 150,
      width: 100,
      height: 30,
      x: 50,
      y: top,
      toJSON: () => ({}),
    });
    const rect = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rectAt(100));
    fireEvent.click(trigger);
    fireEvent.scroll(document);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    rect.mockReturnValue(rectAt(40));
    fireEvent.scroll(document);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when clicking outside', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
