import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control = cn(
  'focus-ring block w-full rounded-md border border-border-strong bg-surface px-3 text-base text-fg sm:text-sm',
  'placeholder:text-fg-subtle',
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
  'aria-[invalid=true]:border-danger',
);

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return <input className={cn(control, 'h-9', className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentPropsWithRef<'textarea'>) {
  return <textarea rows={rows} className={cn(control, 'py-2', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentPropsWithRef<'select'>) {
  return (
    <div className="relative">
      <select className={cn(control, 'h-9 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
}

type CheckboxProps = Omit<ComponentPropsWithRef<'input'>, 'type'> & {
  label: string;
  description?: string;
};

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        aria-describedby={description ? descriptionId : undefined}
        className="focus-ring mt-0.5 size-4 shrink-0 rounded border-border-strong accent-accent"
        {...props}
      />
      <div>
        <label htmlFor={inputId} className="font-medium">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type FieldControlProps = {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
};

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Render the control with the props it needs to be labelled and described. */
  children: (control: FieldControlProps) => ReactNode;
};

/** Label + control + hint/error, wired together with the right ARIA attributes. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-fg-subtle">
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-tone-red-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
