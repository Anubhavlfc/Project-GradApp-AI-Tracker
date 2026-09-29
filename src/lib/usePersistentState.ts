import { useEffect, useState } from 'react';
import { safeStorage } from './storage';

/** useState that mirrors its value to localStorage (JSON). Falls back to `initial`. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = safeStorage.get(key);
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    safeStorage.set(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
