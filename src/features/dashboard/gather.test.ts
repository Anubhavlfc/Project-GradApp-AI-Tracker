import { DataError } from '@/lib/dataError';
import { gather, type QueryLike } from './gather';

const list = (overrides: Partial<QueryLike> = {}): QueryLike => ({
  data: [],
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});
const loading = () => list({ data: undefined });
const failed = (error: unknown = new DataError('network')) =>
  list({ data: undefined, isError: true, error });
const stale = (error: unknown = new DataError('network')) => list({ isError: true, error });

describe('gather', () => {
  it('is ready, with nothing to warn about, when every list has loaded', () => {
    expect(gather([list(), list()])).toEqual({ status: 'ready', warning: null });
    expect(gather([])).toEqual({ status: 'ready', warning: null });
  });

  it('is loading while any list has nothing yet', () => {
    expect(gather([list(), loading()])).toEqual({ status: 'loading' });
    expect(gather([loading(), loading()])).toEqual({ status: 'loading' });
  });

  it('has failed as soon as a list has an error and nothing to show, even while another loads', () => {
    const state = gather([loading(), failed(new DataError('network'))]);
    expect(state).toMatchObject({ status: 'failed' });
    expect(state.status === 'failed' && state.error).toEqual(expect.any(DataError));
  });

  it('reports the error of the list that failed, not of one that only could not refresh', () => {
    const first = new DataError('network');
    const second = new DataError('unknown');
    const state = gather([stale(first), failed(second)]);
    expect(state.status === 'failed' && state.error).toBe(second);
  });

  it('asks again only for the lists that failed', () => {
    const fine = list();
    const broken = failed();
    const old = stale();
    const state = gather([fine, broken, old]);
    if (state.status !== 'failed') throw new Error('expected failed');
    state.retry();
    expect(fine.refetch).not.toHaveBeenCalled();
    expect(broken.refetch).toHaveBeenCalledTimes(1);
    expect(old.refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps showing what it has, with a warning, when a list could not be refreshed', () => {
    const fine = list();
    const old = stale(new DataError('network'));
    const state = gather([fine, old]);
    if (state.status !== 'ready' || !state.warning) throw new Error('expected a warning');
    expect(state.warning.title).toBe('Unable to refresh');
    expect(state.warning.message).toContain('Showing what loaded last.');
    expect(state.warning.message).toContain("Can't reach the server");

    state.warning.retry();
    expect(fine.refetch).not.toHaveBeenCalled();
    expect(old.refetch).toHaveBeenCalledTimes(1);
  });

  it('does not mistake an error that has already been retried for a failure', () => {
    // After "Try again" a list with nothing to show is pending again, not errored.
    expect(gather([list(), list({ data: undefined, isError: false })])).toEqual({
      status: 'loading',
    });
  });
});
