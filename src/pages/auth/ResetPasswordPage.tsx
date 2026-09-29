import { useNavigate } from 'react-router';
import { Link2Off } from 'lucide-react';
import { Alert, Button, ButtonLink, Field } from '@/components/ui';
import { AuthLoading, SetupRequired } from '@/features/auth/RouteGuards';
import { resetPasswordSchema } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/useAuth';
import { useFormSubmit } from '@/lib/forms';
import { AuthLayout } from './AuthLayout';
import { AuthNotice } from './AuthNotice';
import { PasswordInput } from './PasswordInput';

/**
 * Landing page for the emailed reset link. Following the link signs the person in with a
 * short-lived recovery session, so the form is shown only when there is a session.
 */
export function ResetPasswordPage() {
  const { state, updatePassword } = useAuth();
  const navigate = useNavigate();
  const form = useFormSubmit(
    resetPasswordSchema,
    ({ password }) => updatePassword(password),
    () => navigate('/app', { replace: true }),
  );

  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'unconfigured') return <SetupRequired />;

  if (state.status === 'signed_out') {
    return (
      <AuthLayout title="This link isn't valid">
        <AuthNotice
          icon={Link2Off}
          action={
            <ButtonLink to="/forgot-password" variant="primary" className="w-full">
              Request a new link
            </ButtonLink>
          }
        >
          Reset links work once and expire quickly. Request a new one.
        </AuthNotice>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      <form {...form.props} className="space-y-4">
        {form.formError ? <Alert kind="danger" title={form.formError} /> : null}
        <Field label="New password" hint="At least 8 characters." error={form.errors.password}>
          {(control) => (
            <PasswordInput name="password" autoComplete="new-password" autoFocus {...control} />
          )}
        </Field>
        <Field label="Confirm new password" error={form.errors.confirmPassword}>
          {(control) => (
            <PasswordInput name="confirmPassword" autoComplete="new-password" {...control} />
          )}
        </Field>
        <Button type="submit" variant="primary" loading={form.submitting} className="w-full">
          {form.submitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
