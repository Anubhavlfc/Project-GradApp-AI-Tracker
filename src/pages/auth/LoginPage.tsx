import { Link, useLocation, useNavigate } from 'react-router';
import { Alert, Button, Field, Input } from '@/components/ui';
import { returnPath } from '@/features/auth/returnPath';
import { signInSchema } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/useAuth';
import { useFormSubmit } from '@/lib/forms';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';

export function LoginPage() {
  const { state, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useFormSubmit(signInSchema, signIn, () =>
    navigate(returnPath(location.state), { replace: true }),
  );
  const sessionEnded = state.status === 'signed_out' && state.sessionEnded;

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back."
      footer={
        <>
          New here?{' '}
          <Link
            to="/signup"
            className="font-medium text-accent-soft-fg underline underline-offset-2"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form {...form.props} className="space-y-4">
        {sessionEnded ? (
          <Alert kind="warning" title="You've been signed out.">
            Sign in again to continue.
          </Alert>
        ) : null}
        {form.formError ? <Alert kind="danger" title={form.formError} /> : null}
        <Field label="Email" error={form.errors.email}>
          {(control) => (
            <Input name="email" type="email" autoComplete="email" autoFocus {...control} />
          )}
        </Field>
        <Field label="Password" error={form.errors.password}>
          {(control) => (
            <PasswordInput name="password" autoComplete="current-password" {...control} />
          )}
        </Field>
        <div className="text-right">
          <Link
            to="/forgot-password"
            className="text-fg-muted underline underline-offset-2 hover:text-fg"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="primary" loading={form.submitting} className="w-full">
          {form.submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}
