import { useEffect, useState } from 'react';
import { toISODate } from './dates';

/** A moment past midnight, so that the timer never fires a hair early. */
const MARGIN_MS = 1000;

/**
 * Today's date as YYYY-MM-DD in the viewer's own time zone, kept up to date while the page is
 * open. A page left open overnight then says "Due today" instead of "Due tomorrow" without being
 * reloaded. A timer alone would fire late, or not at all, if the computer slept through midnight,
 * so coming back to the page checks the date again.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate());

  useEffect(() => {
    const update = () => setToday(toISODate());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };

    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timer = window.setTimeout(update, midnight.getTime() - now.getTime() + MARGIN_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', update);
    };
    // Starts again for the next midnight each time the date changes.
  }, [today]);

  return today;
}
