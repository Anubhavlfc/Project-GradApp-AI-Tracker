import type { ReactNode } from 'react';
import { Brand } from '@/components/layout/Brand';
import { Card } from '@/components/ui';
import { ThemeMenu } from '@/components/layout/ThemeMenu';

type AuthLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Brand />
        <ThemeMenu />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-8 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-fg-muted">{description}</p> : null}
          <Card className="mt-6 p-5">{children}</Card>
          {footer ? <p className="mt-4 text-center text-fg-muted">{footer}</p> : null}
        </div>
      </main>
    </div>
  );
}
