/** True for http(s) addresses only: the only kind that is safe to put in a link's href. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// An explicit scheme, or one of the schemes that are dangerous or meaningless as a "website".
const SCHEME =
  /^(?:[a-z][a-z\d+.-]*:\/\/|(?:javascript|data|vbscript|file|blob|mailto|tel|about):)/i;

/**
 * Cleans up a web address typed by a person: "stanford.edu/cs" becomes "https://stanford.edu/cs".
 * Returns null when it is not a usable http(s) address (other schemes, spaces, no domain).
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (text === '' || text.length > 2048 || /\s/.test(text)) return null;
  const candidate = SCHEME.test(text) ? text : `https://${text}`;
  if (!isHttpUrl(candidate)) return null;
  return new URL(candidate).hostname.includes('.') ? candidate : null;
}

/** "stanford.edu" for "https://www.stanford.edu/cs": short enough to show as a link's text. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
