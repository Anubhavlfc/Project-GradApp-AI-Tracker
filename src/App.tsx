import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton, SkeletonRegion } from '@/components/ui';
import { DashboardPage } from '@/pages/DashboardPage';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Component gallery for development only; compiled out of production builds.
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/DesignSystemPage'))
  : null;

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        {DesignSystemPage ? (
          <Route
            path="design-system"
            element={
              <Suspense
                fallback={
                  <SkeletonRegion>
                    <Skeleton className="h-8 w-48" />
                  </SkeletonRegion>
                }
              >
                <DesignSystemPage />
              </Suspense>
            }
          />
        ) : null}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
