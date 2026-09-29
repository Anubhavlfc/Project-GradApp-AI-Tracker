import { useState } from 'react';
import { Outlet } from 'react-router';
import { Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Dialog, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { usePersistentState } from '@/lib/usePersistentState';
import { Brand } from './Brand';
import { SidebarNav } from './SidebarNav';
import { ThemeMenu } from './ThemeMenu';

/** Signed-in layout: collapsible sidebar on large screens, top bar + drawer below `lg`. */
export function AppShell() {
  const [collapsed, setCollapsed] = usePersistentState('sidebar-collapsed', false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-150 motion-reduce:transition-none lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'px-4')}>
          <Brand showName={!collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div
          className={cn(
            'flex gap-1 border-t border-border p-2',
            collapsed ? 'flex-col items-center' : 'items-center justify-between',
          )}
        >
          <ThemeMenu align="start" />
          <IconButton
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-4" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-4" />
            )}
          </IconButton>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface px-3 lg:hidden">
          <IconButton
            label="Open navigation"
            aria-haspopup="dialog"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuIcon aria-hidden="true" className="size-5" />
          </IconButton>
          <Brand />
          <div className="ml-auto">
            <ThemeMenu />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8"
        >
          <Outlet />
        </main>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        aria-label="Navigation"
        className="m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] border-r border-border bg-surface p-0 text-fg shadow-xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between px-4">
            <Brand />
            <IconButton label="Close navigation" onClick={() => setDrawerOpen(false)}>
              <X aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
          <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        </div>
      </Dialog>
    </div>
  );
}
