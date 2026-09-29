import indexHtml from '../../index.html?raw';
import vercelJson from '../../vercel.json?raw';

// vercel.json is the only place the security headers live, and nothing else would notice if one
// were dropped or loosened. These tests read the real file.

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };
type VercelConfig = {
  rewrites: { source: string; destination: string }[];
  headers: HeaderRule[];
};

const config = JSON.parse(vercelJson) as VercelConfig;

function headersOf(source: string): Map<string, string> {
  const rules = config.headers.filter((rule) => rule.source === source);
  expect(rules, `a header rule for ${source}`).toHaveLength(1);
  return new Map(
    rules.flatMap((rule) => rule.headers.map((h): [string, string] => [h.key, h.value])),
  );
}

function directivesOf(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

const everyPage = headersOf('/(.*)');
const csp = directivesOf(everyPage.get('Content-Security-Policy') ?? '');

describe('vercel.json', () => {
  it('sends deep links such as /reset-password to the app', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('sends the standard security headers with every page', () => {
    expect(everyPage.get('X-Content-Type-Options')).toBe('nosniff');
    expect(everyPage.get('X-Frame-Options')).toBe('DENY');
    expect(everyPage.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(everyPage.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    const seconds = /^max-age=(\d+)$/.exec(everyPage.get('Strict-Transport-Security') ?? '');
    expect(Number(seconds?.[1])).toBeGreaterThanOrEqual(31_536_000);
  });

  it('keeps the signed-in and password pages out of search results', () => {
    expect(headersOf('/app/:path*').get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(headersOf('/(forgot-password|reset-password)').get('X-Robots-Tag')).toBe(
      'noindex, nofollow',
    );
  });

  it('caches the fingerprinted files under /assets for a year', () => {
    expect(headersOf('/assets/(.*)').get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });
});

describe('Content-Security-Policy', () => {
  it('falls back to this site alone for anything it does not name', () => {
    expect(csp.get('default-src')).toEqual(["'self'"]);
  });

  it('runs scripts from the app itself only: no inline code, no eval, no other host', () => {
    expect(csp.get('script-src')).toEqual(["'self'"]);
  });

  it('allows no inline styles or other hosts for styles, fonts and images', () => {
    expect(csp.get('style-src')).toEqual(["'self'"]);
    expect(csp.get('font-src')).toEqual(["'self'"]);
    expect(csp.get('img-src')).toEqual(["'self'", 'data:']);
  });

  it('lets the browser talk to this site and to Supabase, nowhere else', () => {
    expect(csp.get('connect-src')).toEqual(["'self'", 'https://*.supabase.co']);
  });

  it('blocks plugins, a hijacked <base>, other form targets and being framed', () => {
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
  });

  it('never loosens anything with a wildcard, plain http, or unsafe keyword', () => {
    for (const [name, sources] of csp) {
      for (const source of sources) {
        expect(source, `${name} allows ${source}`).not.toMatch(
          /^\*$|^http:|^ws:|unsafe-|^blob:|^filesystem:/,
        );
      }
    }
  });
});

describe('index.html under that policy', () => {
  it('has no inline script, style, style attribute or event handler for the policy to block', () => {
    const scripts = [...indexHtml.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toMatch(/\bsrc="[^"]+"/);
    expect(indexHtml).not.toMatch(/<script\b[^>]*>(?!\s*<\/script>)/); // a script with a body
    expect(indexHtml).not.toMatch(/<style\b/);
    expect(indexHtml).not.toMatch(/\sstyle=/);
    expect(indexHtml).not.toMatch(/\son[a-z]+=/i);
  });

  it('loads the theme script from a file, before the page is drawn', () => {
    expect(indexHtml).toContain('<script src="/theme-init.js"></script>');
  });
});
