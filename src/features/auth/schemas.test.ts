import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from './schemas';

function messages(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('auth schemas', () => {
  it('trims and lowercases the email', () => {
    const result = signInSchema.parse({ email: '  Ada@Example.COM ', password: 'x' });
    expect(result.email).toBe('ada@example.com');
    expect(forgotPasswordSchema.parse({ email: ' Ada@Example.com' }).email).toBe('ada@example.com');
  });

  it('asks for each missing field by name', () => {
    const result = signInSchema.safeParse({ email: '', password: '' });
    expect(messages(result)).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
  });

  it('rejects malformed emails', () => {
    expect(
      messages(signUpSchema.safeParse({ email: 'not-an-email', password: 'long enough' })),
    ).toEqual({
      email: 'Enter a valid email address.',
    });
  });

  it('does not apply the new-password rules when signing in (older accounts)', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
  });

  it('requires 8 to 72 characters for a new password', () => {
    const base = { email: 'a@b.co' };
    expect(messages(signUpSchema.safeParse({ ...base, password: '1234567' }))).toEqual({
      password: 'Use at least 8 characters.',
    });
    expect(signUpSchema.safeParse({ ...base, password: '12345678' }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, password: 'x'.repeat(72) }).success).toBe(true);
    expect(messages(signUpSchema.safeParse({ ...base, password: 'x'.repeat(73) }))).toEqual({
      password: 'Use 72 characters or fewer.',
    });
  });

  it('checks the confirmation matches on the confirmation field', () => {
    const mismatch = resetPasswordSchema.safeParse({
      password: 'correct horse',
      confirmPassword: 'correct hoarse',
    });
    expect(messages(mismatch)).toEqual({ confirmPassword: 'Passwords do not match.' });
    expect(
      resetPasswordSchema.safeParse({ password: 'correct horse', confirmPassword: 'correct horse' })
        .success,
    ).toBe(true);
  });

  it('does not trim passwords', () => {
    expect(signUpSchema.parse({ email: 'a@b.co', password: '  spaces kept  ' }).password).toBe(
      '  spaces kept  ',
    );
  });
});
