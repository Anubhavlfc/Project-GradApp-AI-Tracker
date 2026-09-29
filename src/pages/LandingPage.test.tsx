import { screen, within } from '@testing-library/react';
import { brand } from '@/config/brand';
import { createFakeAuth, fakeSession } from '@/test/fakeAuth';
import { renderApp } from '@/test/renderApp';

const EXAMPLE_LABEL = 'Example with sample programs. Not real applications.';

const renderVisitor = () => renderApp('/', createFakeAuth().client);

function link(container: HTMLElement, name: string) {
  return within(container).getByRole('link', { name });
}

describe('landing page structure', () => {
  it('has one h1, the tagline, and an h2 for each section', () => {
    renderVisitor();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]?.textContent).toBe(brand.tagline);
    expect(screen.getByText(brand.description)).toBeInTheDocument();
    // Features, how it works, and the closing call to action.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    // Four features and four steps.
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8);
  });

  it('puts everything in header, main and footer landmarks', () => {
    renderVisitor();
    const header = screen.getByRole('banner');
    const main = screen.getByRole('main');
    const footer = screen.getByRole('contentinfo');
    expect(Array.from(main.parentElement?.children ?? [], (el) => el.tagName)).toEqual([
      'HEADER',
      'MAIN',
      'FOOTER',
    ]);
    expect(within(header).getByText(brand.name)).toBeInTheDocument();
    expect(within(main).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(main).getAllByRole('region')).toHaveLength(4);
    expect(footer).toHaveTextContent(brand.name);
    expect(footer).toHaveTextContent(String(new Date().getFullYear()));
  });

  it('lists the four steps in order', () => {
    renderVisitor();
    const steps = within(screen.getByRole('region', { name: 'How it works' }));
    const items = steps.getAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Add a program',
      'Track what it needs',
      'Keep letters and funding in view',
      'Record the decision',
    ]);
  });
});

describe('landing page for a visitor', () => {
  it('links sign-up to /signup and sign-in to /login in every place they appear', () => {
    renderVisitor();
    const header = screen.getByRole('banner');
    const hero = screen.getByRole('region', { name: brand.tagline });
    const closing = screen.getByRole('region', { name: 'Start with your first program.' });
    const footer = screen.getByRole('contentinfo');

    expect(link(header, 'Get started')).toHaveAttribute('href', '/signup');
    expect(link(hero, 'Create an account')).toHaveAttribute('href', '/signup');
    expect(link(closing, 'Get started')).toHaveAttribute('href', '/signup');
    expect(link(footer, 'Create account')).toHaveAttribute('href', '/signup');
    for (const place of [header, hero, closing, footer]) {
      expect(link(place, 'Sign in')).toHaveAttribute('href', '/login');
    }
  });

  it('does not offer the app to someone who is not signed in', () => {
    renderVisitor();
    expect(screen.queryByRole('link', { name: 'Open the app' })).not.toBeInTheDocument();
    for (const anchor of screen.getAllByRole('link')) {
      expect(['/signup', '/login']).toContain(anchor.getAttribute('href'));
    }
  });
});

describe('landing page for someone signed in', () => {
  it('offers the app in place of sign-up and sign-in', async () => {
    renderApp('/', createFakeAuth(fakeSession()).client);
    const header = screen.getByRole('banner');
    const hero = screen.getByRole('region', { name: brand.tagline });
    const closing = screen.getByRole('region', { name: 'Start with your first program.' });
    const footer = screen.getByRole('contentinfo');

    await screen.findAllByRole('link', { name: 'Open the app' });
    for (const place of [header, hero, closing, footer]) {
      expect(link(place, 'Open the app')).toHaveAttribute('href', '/app');
    }
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /account|get started/i })).not.toBeInTheDocument();
  });
});

describe('product preview', () => {
  it('is labelled as example data', () => {
    renderVisitor();
    const figure = screen.getByRole('figure', { name: EXAMPLE_LABEL });
    expect(within(figure).getByText(EXAMPLE_LABEL).tagName).toBe('FIGCAPTION');
  });

  it('hides the sample rows from assistive technology, leaving a description', () => {
    renderVisitor();
    const figure = within(screen.getByRole('figure'));
    expect(figure.queryByRole('table')).not.toBeInTheDocument();
    expect(figure.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(figure.queryByRole('list')).not.toBeInTheDocument();
    expect(figure.getByText(/five sample programs/)).toBeInTheDocument();
  });

  it('shows the five sample programs', () => {
    renderVisitor();
    const figure = within(screen.getByRole('figure'));
    for (const university of [
      'Stanford University',
      'Carnegie Mellon University',
      'University of Washington',
      'Columbia University',
      'UC Berkeley',
    ]) {
      // Drawn twice: as a table for wide screens and as a list for phones.
      expect(figure.getAllByText(university).length).toBeGreaterThan(0);
    }
  });
});

// The product owner's rules for this page, so a later copy edit cannot quietly break them.
describe('landing page content rules', () => {
  const forbidden: [string, RegExp][] = [
    ['a name the product must not use', /grad-?track/i],
    ['AI', /\bAI\b|artificial intelligence|machine learning/i],
    ['a university database or search', /database|university search|search for universities/i],
    ['email or reminders', /\bemails?\b|\breminders?\b|\bnotif|\bautomatic/i],
    ['calendar sync', /calendar|\bsync/i],
    ['file uploads', /\buploads?/i],
    ['sharing or collaboration', /\bshar(e|ed|es|ing)\b|collaborat|invite/i],
    ['mobile apps', /\bmobile\b|\biOS\b|\bAndroid\b|app store/i],
    ['pricing', /\bfree\b|\bpric(e|es|ing)\b|\$\d|\btrial\b/i],
    [
      'social proof',
      /testimonial|trusted by|success rate|\d[\d,]*\+?\s+(students|users|applicants)/i,
    ],
    ['competitors', /spreadsheet|notion|trello|airtable|\bvs\.?\s|alternative to|better than/i],
    ['emoji', /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u],
  ];

  it.each(forbidden)('never mentions %s', (_rule, pattern) => {
    renderVisitor();
    expect(document.body.textContent).not.toMatch(pattern);
  });

  it('keeps that name out of attributes too, such as labels', () => {
    renderVisitor();
    expect(document.body.innerHTML).not.toMatch(/grad-?track/i);
  });

  it('has no images, so no logos', () => {
    renderVisitor();
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });
});
