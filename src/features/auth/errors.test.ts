import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { friendlyAuthMessage, isActionableAuthError } from './errors';

describe('friendlyAuthMessage', () => {
  it.each([
    ['invalid_credentials', 'Incorrect email or password.'],
    ['email_not_confirmed', /confirm your email/i],
    ['weak_password', /at least 8 characters/],
    ['same_password', /different from your current one/],
    ['user_already_exists', /already exists/],
    ['email_exists', /already exists/],
    ['signup_disabled', /turned off/],
    ['over_request_rate_limit', /too many attempts/i],
    ['over_email_send_rate_limit', /too many attempts/i],
    ['session_expired', /sign in again/i],
  ])('explains %s', (code, expected) => {
    const message = friendlyAuthMessage(new AuthApiError('raw server text', 400, code));
    if (typeof expected === 'string') expect(message).toBe(expected);
    else expect(message).toMatch(expected);
  });

  it('reports connection problems', () => {
    expect(friendlyAuthMessage(new TypeError('Failed to fetch'))).toMatch(
      /can't reach the server/i,
    );
    expect(friendlyAuthMessage(new AuthRetryableFetchError('offline', 0))).toMatch(
      /can't reach the server/i,
    );
  });

  it('never shows raw server text for unknown errors', () => {
    const message = friendlyAuthMessage(
      new AuthApiError(
        'duplicate key value violates unique constraint "users_pkey"',
        500,
        'unexpected_failure',
      ),
    );
    expect(message).toBe('Something went wrong. Try again in a moment.');
    expect(friendlyAuthMessage(undefined)).toBe('Something went wrong. Try again in a moment.');
    expect(friendlyAuthMessage('boom')).toBe('Something went wrong. Try again in a moment.');
  });
});

describe('isActionableAuthError', () => {
  it('is true only for problems the person can do something about', () => {
    expect(
      isActionableAuthError(new AuthApiError('slow down', 429, 'over_email_send_rate_limit')),
    ).toBe(true);
    expect(isActionableAuthError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isActionableAuthError(new AuthApiError('no such user', 400, 'user_not_found'))).toBe(
      false,
    );
    expect(isActionableAuthError(new AuthApiError('boom', 500, 'unexpected_failure'))).toBe(false);
  });
});
