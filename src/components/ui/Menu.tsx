import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

const MenuContext = createContext<{ close: () => void } | null>(null);

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

export type MenuTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
};

type MenuProps = {
  /** Accessible name of the menu itself. */
  label: string;
  /** Render the button that opens the menu, spreading the given props onto it. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  align?: 'start' | 'end';
  children: ReactNode;
};

type Position = { top: number; left?: number; right?: number };

const GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Dropdown menu following the WAI-ARIA menu-button pattern (arrow keys, Home/End, Escape).
 * Uses fixed positioning, which escapes `overflow` clipping in tables and cards without a portal,
 * so the menu stays inside its landmark and inside an open <dialog>'s top layer.
 */
export function Menu({ label, trigger, align = 'end', children }: MenuProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = position !== null;

  const close = useCallback((restoreFocus: boolean) => {
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open) return close(true);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      align === 'end'
        ? { top: rect.bottom + GAP, right: window.innerWidth - rect.right }
        : { top: rect.bottom + GAP, left: rect.left },
    );
  };

  // Keep the menu inside the viewport: flip above the trigger when there is no room below (e.g. a
  // button at the bottom of the sidebar) and slide sideways when it would spill off an edge.
  // Written straight to the DOM because the menu's size is only known after it renders.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!open || !menu || !trigger) return;
    const anchor = trigger.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();

    const spaceBelow = window.innerHeight - anchor.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = anchor.top - GAP - VIEWPORT_MARGIN;
    if (height > spaceBelow && spaceAbove > spaceBelow) {
      menu.style.top = `${Math.max(VIEWPORT_MARGIN, anchor.top - GAP - height)}px`;
    }

    const preferredLeft = align === 'end' ? anchor.right - width : anchor.left;
    const maxLeft = window.innerWidth - VIEWPORT_MARGIN - width;
    menu.style.right = 'auto';
    menu.style.left = `${Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft))}px`;
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close(false);
      }
    };
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close(false);
    };
    const onResize = () => close(false);

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (target: number) => {
      event.preventDefault();
      items.at(target % items.length)?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        return move(index + 1);
      case 'ArrowUp':
        return move(index <= 0 ? -1 : index - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(-1);
      case 'Escape':
        event.preventDefault();
        return close(true);
      case 'Tab':
        return close(false);
    }
  };

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: toggle,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
      })}
      {position ? (
        <MenuContext value={{ close: () => close(true) }}>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{
              position: 'fixed',
              maxHeight: `calc(100dvh - ${VIEWPORT_MARGIN * 2}px)`,
              ...position,
            }}
            className="z-50 min-w-44 overflow-y-auto rounded-lg border border-border bg-surface p-1 text-fg shadow-lg"
          >
            {children}
          </div>
        </MenuContext>
      ) : null}
    </>
  );
}

type MenuItemProps = {
  children: ReactNode;
  onSelect?: () => void;
  icon?: ReactNode;
  /** Makes this a radio-style item; pass whether it is the selected one. */
  checked?: boolean;
  destructive?: boolean;
};

export function MenuItem({ children, onSelect, icon, checked, destructive }: MenuItemProps) {
  const menu = useContext(MenuContext);
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      tabIndex={-1}
      onClick={() => {
        onSelect?.();
        menu?.close();
      }}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm focus:bg-surface-muted focus:outline-none',
        destructive ? 'text-tone-red-fg' : 'text-fg',
      )}
    >
      {icon ? <span className="text-fg-muted">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {checked ? <Check aria-hidden="true" className="size-4 text-fg-muted" /> : null}
    </button>
  );
}
