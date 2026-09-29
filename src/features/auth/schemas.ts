import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address.'))
  .transform((value) => value.toLowerCase());

// 72 is bcrypt's limit: longer passwords would be silently truncated.
const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.');

export const signInSchema = z.object({
  email,
  // Don't enforce the sign-up rules here: older accounts may predate them.
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z.object({ email, password: newPassword });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
