import { NavLink } from 'react-router';
import { primaryNav } from '@/config/nav';
import { cn } from '@/lib/cn';

type SidebarNavProps = { collapsed?: boolean; onNavigate?: () => void };

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
      <ul className="space-y-0.5">
        {primaryNav.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'focus-ring flex h-9 items-center gap-3 rounded-md text-sm font-medium',
                  collapsed ? 'justify-center' : 'px-2.5',
                  isActive
                    ? 'bg-accent-soft text-accent-soft-fg'
                    : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                )
              }
            >
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className={collapsed ? 'sr-only' : undefined}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
