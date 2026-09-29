import { returnPath } from './returnPath';

describe('returnPath', () => {
  it('goes back to the page the person was sent away from', () => {
    expect(
      returnPath({ from: { pathname: '/app/applications', search: '?status=submitted' } }),
    ).toBe('/app/applications?status=submitted');
  });

  it('defaults to the dashboard', () => {
    expect(returnPath(null)).toBe('/app');
    expect(returnPath(undefined)).toBe('/app');
    expect(returnPath({})).toBe('/app');
    expect(returnPath({ from: {} })).toBe('/app');
  });

  it('ignores anything outside the app', () => {
    expect(returnPath({ from: { pathname: '/login' } })).toBe('/app');
    expect(returnPath({ from: { pathname: '//evil.example' } })).toBe('/app');
    expect(returnPath({ from: { pathname: '/application-of-evil' } })).toBe('/app');
    expect(returnPath({ from: { pathname: 42 } })).toBe('/app');
  });
});
