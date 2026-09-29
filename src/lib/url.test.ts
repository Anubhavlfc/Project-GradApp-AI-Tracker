import { isHttpUrl, normalizeUrl } from './url';

describe('isHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(isHttpUrl('https://stanford.edu')).toBe(true);
    expect(isHttpUrl('http://stanford.edu/cs')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isHttpUrl('ftp://stanford.edu')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrl('stanford.edu/cs')).toBe('https://stanford.edu/cs');
    expect(normalizeUrl('  www.mit.edu  ')).toBe('https://www.mit.edu');
    expect(normalizeUrl('stanford.edu:8080/x')).toBe('https://stanford.edu:8080/x');
  });

  it('keeps an existing http(s) scheme, in any case', () => {
    expect(normalizeUrl('http://stanford.edu')).toBe('http://stanford.edu');
    expect(normalizeUrl('HTTPS://Stanford.edu')).toBe('HTTPS://Stanford.edu');
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'ftp://stanford.edu',
    'mailto:admissions@stanford.edu',
    'https://has space.edu',
    'https://nodot',
    'localhost',
    '',
    '   ',
  ])('refuses %j', (input) => {
    expect(normalizeUrl(input)).toBeNull();
  });

  it('refuses addresses longer than the database allows', () => {
    expect(normalizeUrl(`https://stanford.edu/${'a'.repeat(2048)}`)).toBeNull();
  });
});
