// What browsers say when a piece of the app cannot be downloaded: the connection dropped, or the
// app was updated since this page was opened and the old file no longer exists.
const MESSAGES = [
  /failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
];

/** True when the error means "a part of the app could not be downloaded", which a reload fixes. */
export function isLoadFailure(error: unknown): boolean {
  return error instanceof Error && MESSAGES.some((pattern) => pattern.test(error.message));
}
