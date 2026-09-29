import { useState } from 'react';
import { Link } from 'react-router';
import { MailCheck } from 'lucide-react';
import { Alert, Button, ButtonLink, Field, Input } from '@/components/ui';
import { forgotPasswordSchema } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/useAuth';
import { useFormSubmit } from '@/lib/forms';
import { AuthLayout } from './AuthLayout';
import { AuthNotice } from './AuthNotice';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useFormSubmit(
    forgotPasswordSchema,
    ({ email }) => requestPasswordReset(email),
    ({ email }) => setSentTo(email),
  );

  if (sentTo) {
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
          If an account exists for {sentTo}, we've sent a link to choose a new password.
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we'll send you a link."
      footer={
        <Link to="/login" className="font-medium text-accent-soft-fg underline underline-offset-2">
          Back to sign in
        </Link>
      }
    >
      <form {...form.props} className="space-y-4">
        {form.formError ? <Alert kind="danger" title={form.formError} /> : null}
        <Field label="Email" error={form.errors.email}>
          {(control) => (
            <Input name="email" type="email" autoComplete="email" autoFocus {...control} />
          )}
        </Field>
        <Button type="submit" variant="primary" loading={form.submitting} className="w-full">
          {form.submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
