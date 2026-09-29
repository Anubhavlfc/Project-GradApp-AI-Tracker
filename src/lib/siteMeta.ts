/**
 * The site-wide tags in index.html (title, description, Open Graph, Twitter card) come from the
 * brand settings, so renaming the product stays a one-line change in src/config/brand.ts.
 * vite.config.ts applies this in the dev server and in the build.
 *
 * No imports on purpose: vite.config.ts runs this at build time too.
 */

export type SiteMeta = { name: string; tagline: string; description: string };

/** A tag for Vite to add to <head>; the same shape as Vite's HtmlTagDescriptor. */
export type HeadTag = {
  tag: 'link' | 'meta';
  attrs: Record<string, string>;
  injectTo: 'head';
};

// Placeholders in index.html are written %SITE_TITLE%, %SITE_NAME% and %SITE_DESCRIPTION%.
const PLACEHOLDER = /%SITE_[A-Z_]+%/g;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Safe inside element text and inside a quoted attribute. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** "Application Command Center – Your graduate school applications, organized". */
export function pageTitle({ name, tagline }: SiteMeta): string {
  const summary = tagline.trim().replace(/\.+$/, '');
  return summary ? `${name} – ${summary}` : name;
}

/**
 * Replaces every placeholder in `html`. Throws when a placeholder has no value (a typo in
 * index.html) or when a brand value is empty, so the mistake stops the build instead of
 * shipping an empty title or a stray "%SITE_TITEL%" in the page.
 */
export function fillSiteMeta(html: string, meta: SiteMeta): string {
  if (!meta.name.trim() || !meta.description.trim()) {
    throw new Error('brand.name and brand.description are needed for the page title and preview.');
  }
  const values: Record<string, string> = {
    '%SITE_NAME%': escapeHtml(meta.name),
    '%SITE_TITLE%': escapeHtml(pageTitle(meta)),
    '%SITE_DESCRIPTION%': escapeHtml(meta.description),
  };

  const unknown = new Set<string>();
  // One pass with a function: inserted text is not scanned again, and "$&" in a value stays text.
  const filled = html.replace(PLACEHOLDER, (token) => {
    const value = values[token];
    if (value === undefined) unknown.add(token);
    return value ?? token;
  });
  if (unknown.size > 0) {
    throw new Error(`index.html has placeholders with no value: ${[...unknown].join(', ')}`);
  }
  return filled;
}

/**
 * VITE_SITE_URL cleaned up: the address the site is served from, needed for the canonical link
 * and og:url. Undefined when unset or blank. Throws for anything that is not an http(s) address,
 * so a typo fails the build instead of quietly dropping the tags.
 */
export function parseSiteUrl(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.hostname) {
      return `${url.origin}${url.pathname}`;
    }
  } catch {
    // Not an address at all: reported below.
  }
  throw new Error(
    `VITE_SITE_URL must be a full http(s) address such as https://example.com (got "${text}").`,
  );
}

/** The tags that need the deployed address. There are none until it is known. */
export function siteUrlTags(siteUrl: string | undefined): HeadTag[] {
  if (!siteUrl) return [];
  return [
    { tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' },
    { tag: 'meta', attrs: { property: 'og:url', content: siteUrl }, injectTo: 'head' },
  ];
}
