function readProperty(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

function isNetworkError(error: unknown): boolean {
  return (
    readProperty(error, 'name') === 'AuthRetryableFetchError' ||
    readProperty(error, 'status') === 0 ||
    error instanceof TypeError
  );
}

function isRateLimitError(error: unknown): boolean {
  const code = readProperty(error, 'code');
  return code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit';
}

/** Errors the person can do something about, as opposed to ones we hide for privacy. */
export function isActionableAuthError(error: unknown): boolean {
  return isRateLimitError(error) || isNetworkError(error);
}

/** Turns Supabase auth errors into short messages a person can act on. */
export function friendlyAuthMessage(error: unknown): string {
  switch (readProperty(error, 'code')) {
    case 'invalid_credentials':
      return 'Incorrect email or password.';
    case 'email_not_confirmed':
      return 'Confirm your email address first. Check your inbox for the link we sent.';
    case 'weak_password':
      return 'Choose a stronger password. Use at least 8 characters.';
    case 'same_password':
      return 'Your new password must be different from your current one.';
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in instead.';
    case 'signup_disabled':
      return 'New sign-ups are turned off right now.';
    case 'user_banned':
      return 'This account is unavailable.';
    case 'session_expired':
    case 'session_not_found':
    case 'refresh_token_not_found':
      return 'Your session expired. Sign in again.';
  }
  if (isRateLimitError(error)) return 'Too many attempts. Wait a few minutes and try again.';
  if (isNetworkError(error)) return "Can't reach the server. Check your connection and try again.";
  return 'Something went wrong. Try again in a moment.';
}
