import { act, renderHook } from '@testing-library/react';
import { useToday } from './useToday';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// Tests run in America/Los_Angeles (see vite.config.ts), so "midnight" is local midnight there.
const EVENING = new Date('2026-10-15T20:30:00'); // 8:30 pm

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: EVENING });
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('starts as today’s date, in the viewer’s own day', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-10-15');
  });

  it('turns over to the next day just after midnight, and not before', () => {
    const { result } = renderHook(() => useToday());
    act(() => vi.advanceTimersByTime(3 * HOUR + 29 * MINUTE)); // 11:59 pm
    expect(result.current).toBe('2026-10-15');
    act(() => vi.advanceTimersByTime(2 * MINUTE)); // 12:01 am
    expect(result.current).toBe('2026-10-16');
  });

  it('keeps turning over, day after day', () => {
    const { result } = renderHook(() => useToday());
    act(() => vi.advanceTimersByTime(4 * HOUR));
    expect(result.current).toBe('2026-10-16');
    act(() => vi.advanceTimersByTime(24 * HOUR));
    expect(result.current).toBe('2026-10-17');
    act(() => vi.advanceTimersByTime(24 * HOUR));
    expect(result.current).toBe('2026-10-18');
  });

  it('turns over at the end of a month and a year', () => {
    vi.setSystemTime(new Date('2026-12-31T23:30:00'));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-12-31');
    act(() => vi.advanceTimersByTime(HOUR));
    expect(result.current).toBe('2027-01-01');
  });

  it('turns over at local midnight on the day the clocks go back', () => {
    // Los Angeles goes back one hour at 2 am on Nov 1, 2026, so that day has 25 hours.
    vi.setSystemTime(new Date('2026-10-31T23:00:00'));
    const { result } = renderHook(() => useToday());
    act(() => vi.advanceTimersByTime(HOUR + 2000));
    expect(result.current).toBe('2026-11-01');
    act(() => vi.advanceTimersByTime(24 * HOUR)); // 11 pm on Nov 1, an hour before midnight
    expect(result.current).toBe('2026-11-01');
    act(() => vi.advanceTimersByTime(HOUR + 2000));
    expect(result.current).toBe('2026-11-02');
  });

  describe('when the computer slept through midnight', () => {
    // The timer never fired, but the clock moved on.
    it('checks again when the page is shown', () => {
      const { result } = renderHook(() => useToday());
      vi.setSystemTime(new Date('2026-10-17T09:00:00'));
      expect(result.current).toBe('2026-10-15');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current).toBe('2026-10-17');
    });

    it('does not check while the page is hidden', () => {
      const { result } = renderHook(() => useToday());
      vi.setSystemTime(new Date('2026-10-17T09:00:00'));
      setVisibility('hidden');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current).toBe('2026-10-15');
    });

    it('checks again when the window is focused', () => {
      const { result } = renderHook(() => useToday());
      vi.setSystemTime(new Date('2026-10-17T09:00:00'));
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(result.current).toBe('2026-10-17');
    });

    it('goes on to the right midnight afterwards', () => {
      const { result } = renderHook(() => useToday());
      vi.setSystemTime(new Date('2026-10-17T09:00:00'));
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      act(() => vi.advanceTimersByTime(16 * HOUR)); // 1 am on the 18th
      expect(result.current).toBe('2026-10-18');
    });
  });

  it('does not draw anything again when the date has not changed', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useToday();
    });
    const before = renders;
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(renders).toBe(before);
    expect(result.current).toBe('2026-10-15');
  });

  it('cleans up after itself', () => {
    const removeDocument = vi.spyOn(document, 'removeEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useToday());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('focus', expect.any(Function));
    removeDocument.mockRestore();
    removeWindow.mockRestore();
  });

  it('keeps one timer while it runs, however many times the date turns over', () => {
    renderHook(() => useToday());
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(4 * HOUR));
    expect(vi.getTimerCount()).toBe(1);
  });
});
