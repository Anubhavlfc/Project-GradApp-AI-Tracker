import { createSupabaseClient } from './supabase';

const URL = 'https://project.supabase.example';
const KEY = 'sb_publishable_test';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSupabaseClient', () => {
  it('gives no client until both the address and the public key are set', () => {
    expect(createSupabaseClient(undefined, KEY)).toBeNull();
    expect(createSupabaseClient(URL, undefined)).toBeNull();
    expect(createSupabaseClient('', '')).toBeNull();
  });

  it('refuses a secret key, which must never be shipped to the browser', () => {
    expect(() => createSupabaseClient(URL, 'sb_secret_abc123')).toThrow(/secret/);
  });

  it('asks the server once when a read fails, leaving retrying to the query cache', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const client = createSupabaseClient(URL, KEY);

    // Left to itself, supabase-js waits 1, 2 and 4 seconds and asks three more times, which is
    // longer than this test is allowed to run.
    const { error } = await client!.from('tasks').select('*');

    expect(error).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
