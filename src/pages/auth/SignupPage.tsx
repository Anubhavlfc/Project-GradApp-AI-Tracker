import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MailCheck } from 'lucide-react';
import { Alert, Button, ButtonLink, Field, Input } from '@/components/ui';
import { signUpSchema } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/useAuth';
import { useFormSubmit } from '@/lib/forms';
import { AuthLayout } from './AuthLayout';
import { AuthNotice } from './AuthNotice';
import { PasswordInput } from './PasswordInput';

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const form = useFormSubmit(signUpSchema, signUp, ({ email }, result) => {
    if (result.needsEmailConfirmation) setConfirmationSentTo(email);
    else navigate('/app', { replace: true });
  });

  if (confirmationSentTo) {
    return (
      <AuthLayout title="Check your email">
        <AuthNotice
          icon={MailCheck}
          action={
            <ButtonLink to="/login" className="w-full">
              Back to sign in
            </ButtonLink>
          }
        >
          If {confirmationSentTo} can be used for a new account, we've sent a confirmation link.
          Open it to finish signing up.
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Track every graduate application in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-accent-soft-fg underline underline-offset-2"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form {...form.props} className="space-y-4">
        {form.formError ? <Alert kind="danger" title={form.formError} /> : null}
        <Field label="Email" error={form.errors.email}>
          {(control) => (
            <Input name="email" type="email" autoComplete="email" autoFocus {...control} />
          )}
        </Field>
        <Field label="Password" hint="At least 8 characters." error={form.errors.password}>
          {(control) => <PasswordInput name="password" autoComplete="new-password" {...control} />}
        </Field>
        <Button type="submit" variant="primary" loading={form.submitting} className="w-full">
          {form.submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
