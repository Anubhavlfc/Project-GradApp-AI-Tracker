import type { z } from 'zod';
import { DataError, toDataError } from './dataError';
import { logError } from './log';

/** Checks rows from the database against their schema, so a mismatch fails here, not on screen. */
export function parseRows<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new DataError('unknown', { cause: result.error });
  return result.data;
}

/**
 * `guard('save', run)` runs one operation of a data API: it logs the technical detail (in
 * development) under `scope.save` and throws an error whose message is fit for the screen.
 */
export function createGuard(scope: string) {
  return async function guard<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      logError(`${scope}.${operation}`, error);
      throw toDataError(error);
    }
  };
}
