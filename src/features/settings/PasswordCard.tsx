import { useState } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Field } from '@/components/ui';
import { resetPasswordSchema } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/useAuth';
import { PasswordInput } from '@/pages/auth/PasswordInput';
import { useFormSubmit } from '@/lib/forms';

/** Changing the password of the signed-in account. */
export function PasswordCard() {
  const { updatePassword } = useAuth();
  // Bumped after each save: a new key gives a fresh, empty form.
  const [saves, setSaves] = useState(0);
  const [saved, setSaved] = useState(false);
  const form = useFormSubmit(
    resetPasswordSchema,
    ({ password }) => updatePassword(password),
    () => {
      setSaves((count) => count + 1);
      setSaved(true);
    },
  );

  return (
    <Card>
      <CardHeader title="Password" description="Choose a new password for signing in." />
      <CardBody>
        <form
          key={saves}
          {...form.props}
          onChange={() => setSaved(false)}
          className="max-w-sm space-y-4"
        >
          {saved ? <Alert kind="success" title="Your password was changed." /> : null}
          {form.formError ? <Alert kind="danger" title={form.formError} /> : null}
          <Field label="New password" hint="At least 8 characters." error={form.errors.password}>
            {(control) => (
              <PasswordInput name="password" autoComplete="new-password" {...control} />
            )}
          </Field>
          <Field label="Confirm new password" error={form.errors.confirmPassword}>
            {(control) => (
              <PasswordInput name="confirmPassword" autoComplete="new-password" {...control} />
            )}
          </Field>
          <Button type="submit" loading={form.submitting}>
            {form.submitting ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
