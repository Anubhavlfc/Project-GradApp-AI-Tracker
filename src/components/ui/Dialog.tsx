import { useEffect, useId, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

type DialogProps = Omit<ComponentPropsWithoutRef<'dialog'>, 'open' | 'onClose'> & {
  open: boolean;
  onClose: () => void;
};

/**
 * Thin wrapper over the native <dialog>: the browser provides the focus trap, inert background,
 * top layer and Escape handling. The parent stays in control through `open`/`onClose`.
 */
export function Dialog({ open, onClose, onClick, children, ...props }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      // Start on the field the dialog is for, instead of on the close button.
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself (not its content) is a click on the backdrop.
        if (event.target === event.currentTarget) onClose();
        onClick?.(event);
      }}
      {...props}
    >
      {open ? children : null}
    </dialog>
  );
}

const modalSizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Action buttons, right-aligned. */
  footer?: ReactNode;
  size?: keyof typeof modalSizes;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-surface p-0 text-fg shadow-xl',
        modalSizes[size],
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-base font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 break-words text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </Dialog>
  );
}

/**
 * The buttons at the foot of a form inside a Modal. They stay in view while the form scrolls, so a
 * long form on a short screen never hides its Save button. Place it last inside the <form>.
 */
export function FormFooter({ children }: { children: ReactNode }) {
  // The Modal pads its body by 1rem all round. The negative margin and offset cancel that
  // padding at the bottom edge, so the bar sits flush with the dialog while stuck.
  return (
    <div className="sticky -bottom-4 -mx-5 -mb-4 flex justify-end gap-2 border-t border-border bg-surface px-5 py-3">
      {children}
    </div>
  );
}
