import { useEffect, useState, type FormEvent } from 'react';
import type { z } from 'zod';

export type FieldErrors = Record<string, string>;

export type ParsedForm<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** Validates a form's values with a Zod schema and returns one message per field. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  form: HTMLFormElement,
): ParsedForm<z.output<S>> {
  const result = schema.safeParse(Object.fromEntries(new FormData(form)));
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? '');
    if (field && !(field in errors)) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Moves keyboard focus to the first invalid field after a failed submit. */
function useFocusFirstError(form: HTMLFormElement | null, errors: FieldErrors) {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form, errors]);
}

type Outcome = { ok: true } | { ok: false; message: string };

/**
 * The shared shape of a form: validate with a schema, send, then either continue or show the
 * server's message. Blocks a second submit while one is in flight and focuses the first problem.
 */
export function useFormSubmit<S extends z.ZodType, R extends Outcome>(
  schema: S,
  submit: (data: z.output<S>) => Promise<R>,
  onSuccess: (data: z.output<S>, result: Extract<R, { ok: true }>) => void,
) {
  const [element, setElement] = useState<HTMLFormElement | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useFocusFirstError(element, errors);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const parsed = parseForm(schema, event.currentTarget);
    if (!parsed.ok) return setErrors(parsed.errors);
    setErrors({});
    setSubmitting(true);
    const result = await submit(parsed.data);
    setSubmitting(false);
    if (result.ok) onSuccess(parsed.data, result as Extract<R, { ok: true }>);
    else setFormError(result.message);
  }

  return {
    /** Spread onto the <form>: `<form {...form.props}>`. */
    props: { ref: setElement, onSubmit, noValidate: true },
    errors,
    formError,
    submitting,
  };
}
