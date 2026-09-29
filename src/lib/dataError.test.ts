import { DataError, toDataError } from './dataError';

describe('toDataError', () => {
  it('recognises an expired session', () => {
    expect(toDataError({ code: 'PGRST301', message: 'JWT expired' }).kind).toBe('session');
    expect(toDataError({ status: 401, message: 'nope' }).kind).toBe('session');
  });

  it('recognises a row level security refusal', () => {
    expect(
      toDataError({ code: '42501', message: 'new row violates row-level security' }).kind,
    ).toBe('permission');
  });

  it('recognises a missing row', () => {
    expect(toDataError({ code: 'PGRST116', message: '0 rows' }).kind).toBe('not_found');
  });

  it('recognises values the database refused', () => {
    for (const code of ['23514', '22001', '22007', '22P02']) {
      expect(toDataError({ code, message: 'bad' }).kind).toBe('invalid');
    }
  });

  it('recognises clashes with other data', () => {
    expect(toDataError({ code: '23505', message: 'duplicate' }).kind).toBe('conflict');
    expect(toDataError({ code: '23503', message: 'foreign key' }).kind).toBe('conflict');
  });

  it('recognises a lost connection, however the browser words it', () => {
    expect(toDataError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(toDataError({ code: '', message: 'TypeError: Load failed' }).kind).toBe('network');
    expect(
      toDataError({ code: '', message: 'TypeError: NetworkError when attempting to fetch' }).kind,
    ).toBe('network');
  });

  it('falls back to a generic message and never leaks technical details', () => {
    const error = toDataError({ code: 'XX000', message: 'internal error at pg_foo.c:123' });
    expect(error.kind).toBe('unknown');
    expect(error.message).toBe('Something went wrong. Try again in a moment.');
  });

  it('keeps the original error as the cause for logging', () => {
    const cause = { code: '42501', message: 'x' };
    expect(toDataError(cause).cause).toBe(cause);
  });

  it('passes an existing DataError through untouched', () => {
    const original = new DataError('network');
    expect(toDataError(original)).toBe(original);
  });
});
