import { brand } from '@/config/brand';
import indexHtml from '../../index.html?raw';
import robotsTxt from '../../public/robots.txt?raw';
import { escapeHtml, fillSiteMeta, pageTitle, parseSiteUrl, siteUrlTags } from './siteMeta';

const meta = {
  name: 'Acme Tracker',
  tagline: 'Everything, in order.',
  description: 'Keep track of it all.',
};

describe('pageTitle', () => {
  it('joins the name and tagline, without the final period', () => {
    expect(pageTitle(meta)).toBe('Acme Tracker – Everything, in order');
  });

  it('is just the name when there is no tagline', () => {
    expect(pageTitle({ ...meta, tagline: ' ' })).toBe('Acme Tracker');
  });
});

describe('escapeHtml', () => {
  it('escapes what could end an attribute or start a tag', () => {
    expect(escapeHtml(`Tom & "Jerry" <b>'s`)).toBe('Tom &amp; &quot;Jerry&quot; &lt;b&gt;&#39;s');
  });
});

describe('fillSiteMeta', () => {
  it('fills every occurrence of every placeholder', () => {
    const html =
      '<title>%SITE_TITLE%</title><meta content="%SITE_DESCRIPTION%"><meta content="%SITE_NAME%">' +
      '<meta content="%SITE_TITLE%">';
    expect(fillSiteMeta(html, meta)).toBe(
      '<title>Acme Tracker – Everything, in order</title><meta content="Keep track of it all.">' +
        '<meta content="Acme Tracker"><meta content="Acme Tracker – Everything, in order">',
    );
  });

  it('escapes brand values so they cannot break out of an attribute', () => {
    const html = '<meta content="%SITE_DESCRIPTION%">';
    const filled = fillSiteMeta(html, { ...meta, description: 'Say "hi" <now> & later' });
    expect(filled).toBe('<meta content="Say &quot;hi&quot; &lt;now&gt; &amp; later">');
  });

  it('inserts values literally, even ones that look like replacement patterns', () => {
    const filled = fillSiteMeta('<p>%SITE_NAME%</p>', { ...meta, name: 'Save $& more $1' });
    expect(filled).toBe('<p>Save $&amp; more $1</p>');
  });

  it('does not read a value as another placeholder', () => {
    const filled = fillSiteMeta('<p>%SITE_NAME%</p>', { ...meta, name: '%SITE_TITLE%' });
    expect(filled).toBe('<p>%SITE_TITLE%</p>');
  });

  it('leaves other percent signs alone', () => {
    expect(fillSiteMeta('<p>100% of %SITE_NAME%</p>', meta)).toBe('<p>100% of Acme Tracker</p>');
  });

  it('throws, naming it, when a placeholder has no value', () => {
    expect(() => fillSiteMeta('<title>%SITE_TITEL%</title> %SITE_ODD%', meta)).toThrow(
      /%SITE_TITEL%, %SITE_ODD%/,
    );
  });

  it('throws when the brand has no name or description', () => {
    expect(() => fillSiteMeta('<p>%SITE_NAME%</p>', { ...meta, name: ' ' })).toThrow(/brand/);
    expect(() => fillSiteMeta('<p>%SITE_NAME%</p>', { ...meta, description: '' })).toThrow(/brand/);
  });
});

describe('parseSiteUrl', () => {
  it('is undefined when the variable is not set', () => {
    expect(parseSiteUrl(undefined)).toBeUndefined();
    expect(parseSiteUrl('')).toBeUndefined();
    expect(parseSiteUrl('   ')).toBeUndefined();
  });

  it('returns the address of the site root', () => {
    expect(parseSiteUrl('https://example.test')).toBe('https://example.test/');
    expect(parseSiteUrl(' https://www.example.test/ ')).toBe('https://www.example.test/');
    expect(parseSiteUrl('http://localhost:3000')).toBe('http://localhost:3000/');
  });

  it('keeps a path, and drops anything after it', () => {
    expect(parseSiteUrl('https://example.test/tracker/?a=1#top')).toBe(
      'https://example.test/tracker/',
    );
  });

  it.each(['example.test', 'ftp://example.test', 'javascript:alert(1)', 'https://', 'not a url'])(
    'rejects %s',
    (value) => {
      expect(() => parseSiteUrl(value)).toThrow(/VITE_SITE_URL/);
    },
  );
});

describe('siteUrlTags', () => {
  it('adds a canonical link and og:url when the address is known', () => {
    expect(siteUrlTags('https://example.test/')).toEqual([
      { tag: 'link', attrs: { rel: 'canonical', href: 'https://example.test/' }, injectTo: 'head' },
      {
        tag: 'meta',
        attrs: { property: 'og:url', content: 'https://example.test/' },
        injectTo: 'head',
      },
    ]);
  });

  it('adds neither when it is not', () => {
    expect(siteUrlTags(undefined)).toEqual([]);
  });
});

describe('index.html', () => {
  const html = fillSiteMeta(indexHtml, brand);

  it('has no placeholder left after the brand is filled in', () => {
    expect(html).not.toMatch(/%[A-Z_]+%/);
  });

  it('gets its title and description from the brand', () => {
    expect(html).toContain(`<title>${escapeHtml(pageTitle(brand))}</title>`);
    expect(html).toContain(
      `<meta name="description" content="${escapeHtml(brand.description)}" />`,
    );
  });

  it('describes the page for link previews', () => {
    expect(html).toContain('<meta property="og:type" content="website" />');
    expect(html).toContain(`<meta property="og:site_name" content="${escapeHtml(brand.name)}" />`);
    expect(html).toContain('<meta property="og:locale" content="en_US" />');
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
    for (const property of ['og:title', 'og:description']) {
      expect(html).toMatch(new RegExp(`<meta property="${property}" content="[^"]+" />`));
    }
    for (const name of ['twitter:title', 'twitter:description', 'theme-color']) {
      expect(html).toMatch(new RegExp(`<meta name="${name}" content="[^"]+"`));
    }
  });

  it('links the favicon', () => {
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });

  it('does not hard-code the product name, so renaming stays a one-line change', () => {
    expect(indexHtml).not.toContain(brand.name);
    expect(indexHtml).not.toContain(brand.tagline);
    expect(indexHtml).not.toContain(brand.description);
  });

  it('leaves the address-dependent tags to the plugin, and has no og:image', () => {
    expect(indexHtml).not.toMatch(/rel="canonical"|property="og:(url|image)"/);
  });
});

describe('robots.txt', () => {
  it('lets crawlers in, keeps them out of the signed-in pages, and has no sitemap', () => {
    const rules = robotsTxt
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    expect(rules).toEqual(['User-agent: *', 'Allow: /', 'Disallow: /app']);
  });
});
