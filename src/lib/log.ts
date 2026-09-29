/** Central place for error logging: verbose in development, a hook for monitoring later. */
export function logError(scope: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[${scope}]`, error);
  }
}
