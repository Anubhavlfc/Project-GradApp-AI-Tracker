import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import type { AuthClient } from '@/features/auth/AuthProvider';
import { authError, createFakeAuth, fakeSession, fakeUser } from '@/test/fakeAuth';
import { renderApp } from '@/test/renderApp';

type SignInResult = Awaited<ReturnType<AuthClient['signInWithPassword']>>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const dashboard = () => screen.findByRole('heading', { level: 1, name: 'Dashboard' });

describe('signing in', () => {
  it('sends people who are signed out to the login page', async () => {
    renderApp('/app', createFakeAuth().client);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
  });

  it('opens the dashboard after a successful sign-in', async () => {
    const fake = createFakeAuth();
    renderApp('/login', fake.client);
    await screen.findByRole('heading', { name: 'Sign in' });
    fill('Email', '  Ada@Example.com ');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await dashboard();
    expect(fake.client.signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'correct horse',
    });
  });

  it('explains what is missing and focuses the first problem without calling the server', async () => {
    const fake = createFakeAuth();
    renderApp('/login', fake.client);
    await screen.findByRole('heading', { name: 'Sign in' });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(fake.client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows a friendly message for a wrong password and lets the person try again', async () => {
    const fake = createFakeAuth();
    fake.client.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('invalid_credentials', 'Invalid login credentials'),
    });
    renderApp('/login', fake.client);
    await screen.findByRole('heading', { name: 'Sign in' });
    fill('Email', 'ada@example.com');
    fill('Password', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    fill('Password', 'right');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await dashboard();
  });

  it('shows a busy button and ignores repeat clicks while the request is in flight', async () => {
    const fake = createFakeAuth();
    const pending = deferred<SignInResult>();
    fake.client.signInWithPassword.mockReturnValueOnce(pending.promise);
    renderApp('/login', fake.client);
    await screen.findByRole('heading', { name: 'Sign in' });
    fill('Email', 'ada@example.com');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const busy = await screen.findByRole('button', { name: 'Signing in…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busy);
    fireEvent.submit(busy.closest('form')!);
    expect(fake.client.signInWithPassword).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({
        data: { user: null, session: null },
        error: authError('invalid_credentials'),
      });
    });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('can show and hide the password', async () => {
    renderApp('/login', createFakeAuth().client);
    await screen.findByRole('heading', { name: 'Sign in' });
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('type', 'button');
    fireEvent.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('skips the login page for people who are already signed in', async () => {
    renderApp('/login', createFakeAuth(fakeSession()).client);
    await dashboard();
  });

  it('links to sign-up and password reset', async () => {
    renderApp('/login', createFakeAuth().client);
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('signing out', () => {
  async function openAccountMenu() {
    fireEvent.click(await screen.findByRole('button', { name: 'Account: ada@example.com' }));
  }

  it('shows who is signed in', async () => {
    renderApp('/app', createFakeAuth(fakeSession()).client);
    await dashboard();
    expect(screen.getByRole('button', { name: 'ada@example.com' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
    await openAccountMenu();
    expect(screen.getByRole('menu', { name: 'Account' })).toHaveTextContent('ada@example.com');
  });

  it('returns to the login page without a "signed out" warning when the person signs out', async () => {
    const fake = createFakeAuth(fakeSession());
    renderApp('/app', fake.client);
    await dashboard();
    await openAccountMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(fake.client.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("You've been signed out.")).not.toBeInTheDocument();
  });

  it('says so when the session ends by itself', async () => {
    const fake = createFakeAuth(fakeSession());
    renderApp('/app', fake.client);
    await dashboard();
    act(() => fake.emit('SIGNED_OUT', null));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText("You've been signed out.")).toBeInTheDocument();
  });

  it('stays signed in and explains when signing out fails', async () => {
    const fake = createFakeAuth(fakeSession());
    fake.client.signOut.mockResolvedValueOnce({ error: new AuthRetryableFetchError('offline', 0) });
    renderApp('/app', fake.client);
    await dashboard();
    await openAccountMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    const dialog = await screen.findByRole('dialog', { name: "Couldn't sign out" });
    expect(dialog).toHaveTextContent("Can't reach the server");
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(fake.client.signOut).toHaveBeenCalledTimes(2);
  });
});

describe('creating an account', () => {
  async function openSignup(fake = createFakeAuth()) {
    renderApp('/signup', fake.client);
    await screen.findByRole('heading', { name: 'Create your account' });
    return fake;
  }

  it('asks the person to confirm their email when the project requires it', async () => {
    const fake = await openSignup();
    fill('Email', 'Ada@Example.com');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/If ada@example\.com can be used for a new account/),
    ).toBeInTheDocument();
    expect(fake.client.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', password: 'correct horse' }),
    );
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('goes straight to the dashboard when no confirmation is needed', async () => {
    const fake = await openSignup();
    const session = fakeSession();
    fake.client.signUp.mockImplementationOnce(async () => {
      fake.emit('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    });
    fill('Email', 'ada@example.com');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await dashboard();
  });

  it('rejects a short password before contacting the server', async () => {
    const fake = await openSignup();
    fill('Email', 'ada@example.com');
    fill('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    expect(fake.client.signUp).not.toHaveBeenCalled();
  });

  it('describes the password rule up front', async () => {
    await openSignup();
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 8 characters.');
  });

  it('shows why sign-up failed', async () => {
    const fake = await openSignup();
    fake.client.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: authError('user_already_exists', 'User already registered'),
    });
    fill('Email', 'ada@example.com');
    fill('Password', 'correct horse');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
  });
});

describe('forgotten passwords', () => {
  async function openForgot(fake = createFakeAuth()) {
    renderApp('/forgot-password', fake.client);
    await screen.findByRole('heading', { name: 'Reset your password' });
    return fake;
  }

  it('sends a link and says so', async () => {
    const fake = await openForgot();
    fill('Email', 'Ada@Example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for ada@example\.com/)).toBeInTheDocument();
    expect(fake.client.resetPasswordForEmail).toHaveBeenCalledWith(
      'ada@example.com',
      expect.any(Object),
    );
  });

  it('gives the same answer for an email with no account', async () => {
    const fake = await openForgot();
    fake.client.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError('User not found', 400, 'user_not_found'),
    });
    fill('Email', 'nobody@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for nobody@example\.com/)).toBeInTheDocument();
  });

  it('tells the person when they are sending too many requests', async () => {
    const fake = await openForgot();
    fake.client.resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'),
    });
    fill('Email', 'ada@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i);
  });

  it('validates the email first', async () => {
    const fake = await openForgot();
    fill('Email', 'not-an-email');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(fake.client.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('choosing a new password', () => {
  it('explains an invalid or expired link and offers a new one', async () => {
    renderApp('/reset-password', createFakeAuth().client);
    expect(
      await screen.findByRole('heading', { level: 1, name: "This link isn't valid" }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('saves the new password and opens the app', async () => {
    const fake = createFakeAuth(fakeSession());
    renderApp('/reset-password', fake.client);
    await screen.findByRole('heading', { name: 'Choose a new password' });
    fill('New password', 'a brand new one');
    fill('Confirm new password', 'a brand new one');
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    await dashboard();
    expect(fake.client.updateUser).toHaveBeenCalledWith({ password: 'a brand new one' });
  });

  it('catches a mismatched confirmation before contacting the server', async () => {
    const fake = createFakeAuth(fakeSession());
    renderApp('/reset-password', fake.client);
    await screen.findByRole('heading', { name: 'Choose a new password' });
    fill('New password', 'a brand new one');
    fill('Confirm new password', 'a brand new two');
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toHaveFocus();
    expect(fake.client.updateUser).not.toHaveBeenCalled();
  });

  it('shows why the server refused the new password', async () => {
    const fake = createFakeAuth(fakeSession());
    fake.client.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: authError('same_password', 'New password should be different'),
    });
    renderApp('/reset-password', fake.client);
    await screen.findByRole('heading', { name: 'Choose a new password' });
    fill('New password', 'a brand new one');
    fill('Confirm new password', 'a brand new one');
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/different from your current one/);
  });
});

describe('when Supabase is not configured', () => {
  it.each(['/app', '/login', '/signup', '/forgot-password', '/reset-password'])(
    'explains what is missing at %s instead of showing a blank page',
    (path) => {
      renderApp(path, null);
      expect(
        screen.getByRole('heading', { level: 1, name: "Sign-in isn't set up yet" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/VITE_SUPABASE_URL/)).toBeInTheDocument();
    },
  );

  it('keeps the public landing page working', () => {
    renderApp('/', null);
    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });
});

describe('while the session is being restored', () => {
  it('shows a loading state, not the login page, then the app', async () => {
    const fake = createFakeAuth(fakeSession(fakeUser()));
    renderApp('/app', fake.client);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your account');
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    await dashboard();
    await waitFor(() => expect(screen.queryByText('Loading your account')).not.toBeInTheDocument());
  });
});
