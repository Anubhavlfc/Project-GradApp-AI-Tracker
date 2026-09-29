import type { ComponentPropsWithRef } from 'react';
import { Link, type LinkProps } from 'react-router';
import { buttonStyles, type StyleOptions } from './buttonStyles';
import { Spinner } from './Spinner';

export type ButtonProps = ComponentPropsWithRef<'button'> &
  StyleOptions & {
    /** Shows a spinner and blocks clicks while a request is in flight. */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = LinkProps & StyleOptions;

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonStyles({ variant, size, className })} {...props} />;
}

export type IconButtonProps = Omit<ButtonProps, 'size' | 'aria-label'> & {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
};

export function IconButton({
  label,
  variant = 'ghost',
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
}
