import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton, SkeletonRegion } from '@/components/ui';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { DashboardPage } from '@/pages/DashboardPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SignupPage } from '@/pages/auth/SignupPage';

// Component gallery for development only; compiled out of production builds.
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/DesignSystemPage'))
  : null;

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      {/* The emailed link signs the person in, so this page is not guest-only. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
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
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
