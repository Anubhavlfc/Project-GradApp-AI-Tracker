import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { NotesDraftProvider } from './NotesDraftProvider';
import { useNotesDrafts } from './notesDraftContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NotesDraftProvider>{children}</NotesDraftProvider>
);

/** Whether the browser would be asked to confirm leaving the page. */
function asksBeforeLeaving(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('NotesDraftProvider', () => {
  it('keeps the unsaved text of a program, and has none for any other', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    expect(result.current.draftFor('p1')).toBeNull();

    act(() => result.current.keep('p1', 'Ask Prof. Lee'));
    expect(result.current.draftFor('p1')).toBe('Ask Prof. Lee');
    expect(result.current.draftFor('p2')).toBeNull();
  });

  it('keeps exactly what was typed, spaces and all', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    act(() => result.current.keep('p1', '  padded \n'));
    expect(result.current.draftFor('p1')).toBe('  padded \n');
  });

  it('keeps an empty draft: clearing the box is an unsaved change too', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    act(() => result.current.keep('p1', ''));
    expect(result.current.draftFor('p1')).toBe('');
  });

  it('forgets it when told to', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    act(() => result.current.keep('p1', 'text'));
    act(() => result.current.keep('p1', null));
    expect(result.current.draftFor('p1')).toBeNull();
  });

  it('keeps one program’s draft when another’s is forgotten', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    act(() => result.current.keep('p1', 'text'));
    act(() => result.current.keep('p2', null));
    expect(result.current.draftFor('p1')).toBe('text');
  });

  it('holds a draft for each program at once', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    act(() => result.current.keep('p1', 'first'));
    act(() => result.current.keep('p2', 'second'));
    expect(result.current.draftFor('p1')).toBe('first');
    expect(result.current.draftFor('p2')).toBe('second');

    act(() => result.current.keep('p1', null));
    expect(result.current.draftFor('p1')).toBeNull();
    expect(result.current.draftFor('p2')).toBe('second');
  });

  it('replaces a program’s draft with what is typed next', () => {
    const { result } = renderHook(() => useNotesDrafts(), { wrapper });
    act(() => result.current.keep('p1', 'first'));
    act(() => result.current.keep('p1', 'first, then more'));
    expect(result.current.draftFor('p1')).toBe('first, then more');
  });

  it('keeps the same functions while nothing changes, so a box is not re-rendered for nothing', () => {
    const { result, rerender } = renderHook(() => useNotesDrafts(), { wrapper });
    const first = result.current.keep;
    rerender();
    expect(result.current.keep).toBe(first);
    act(() => result.current.keep('p1', 'text'));
    expect(result.current.keep).toBe(first);
  });

  it('does not draw anything again when it is told what it already holds', () => {
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useNotesDrafts();
      },
      { wrapper },
    );
    act(() => result.current.keep('p1', 'text'));
    const before = renders;
    const draftFor = result.current.draftFor;
    act(() => result.current.keep('p1', 'text'));
    act(() => result.current.keep('p2', null)); // nothing kept for p2, nothing to forget
    expect(renders).toBe(before);
    expect(result.current.draftFor).toBe(draftFor);

    act(() => result.current.keep('p1', 'text!'));
    expect(renders).toBe(before + 1);
    expect(result.current.draftFor('p1')).toBe('text!');
  });

  describe('closing or reloading the page', () => {
    it('asks first only while something is kept', () => {
      const { result } = renderHook(() => useNotesDrafts(), { wrapper });
      expect(asksBeforeLeaving()).toBe(false);

      act(() => result.current.keep('p1', 'text'));
      expect(asksBeforeLeaving()).toBe(true);

      act(() => result.current.keep('p1', null));
      expect(asksBeforeLeaving()).toBe(false);
    });

    it('keeps asking while another program’s draft is forgotten', () => {
      const { result } = renderHook(() => useNotesDrafts(), { wrapper });
      act(() => result.current.keep('p1', 'text'));
      act(() => result.current.keep('p2', null));
      expect(asksBeforeLeaving()).toBe(true);
    });

    it('keeps asking until the last program’s draft is forgotten', () => {
      const { result } = renderHook(() => useNotesDrafts(), { wrapper });
      act(() => result.current.keep('p1', 'one'));
      act(() => result.current.keep('p2', 'two'));
      act(() => result.current.keep('p1', null));
      expect(asksBeforeLeaving()).toBe(true);
      act(() => result.current.keep('p2', null));
      expect(asksBeforeLeaving()).toBe(false);
    });

    it('stops asking when the signed-in app is closed', () => {
      const { result, unmount } = renderHook(() => useNotesDrafts(), { wrapper });
      act(() => result.current.keep('p1', 'text'));
      expect(asksBeforeLeaving()).toBe(true);
      unmount();
      expect(asksBeforeLeaving()).toBe(false);
    });

    it('asks once, not once per change', () => {
      const add = vi.spyOn(window, 'addEventListener');
      const { result } = renderHook(() => useNotesDrafts(), { wrapper });
      act(() => result.current.keep('p1', 'a'));
      act(() => result.current.keep('p1', 'ab'));
      act(() => result.current.keep('p1', 'abc'));
      expect(add.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(1);
      add.mockRestore();
    });
  });

  it('does nothing, and breaks nothing, outside the signed-in app', () => {
    const { result } = renderHook(() => useNotesDrafts());
    act(() => result.current.keep('p1', 'text'));
    expect(result.current.draftFor('p1')).toBeNull();
    expect(asksBeforeLeaving()).toBe(false);
  });
});
