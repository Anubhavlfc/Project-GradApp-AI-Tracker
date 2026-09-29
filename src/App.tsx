import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton, SkeletonRegion } from '@/components/ui';
import { GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { DashboardPage } from '@/pages/DashboardPage';
import { ApplicationLayout } from '@/pages/applications/ApplicationLayout';
import { ApplicationsPage } from '@/pages/applications/ApplicationsPage';
import { EditApplicationPage } from '@/pages/applications/EditApplicationPage';
import { NewApplicationPage } from '@/pages/applications/NewApplicationPage';
import { OverviewTab } from '@/pages/applications/OverviewTab';
import { RecommendationsTab } from '@/pages/applications/RecommendationsTab';
import { RequirementsTab } from '@/pages/applications/RequirementsTab';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RecommendersPage } from '@/pages/RecommendersPage';
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
          <Route path="applications">
            <Route index element={<ApplicationsPage />} />
            <Route path="new" element={<NewApplicationPage />} />
            <Route path=":applicationId/edit" element={<EditApplicationPage />} />
            <Route path=":applicationId" element={<ApplicationLayout />}>
              <Route index element={<OverviewTab />} />
              <Route path="requirements" element={<RequirementsTab />} />
              <Route path="recommendations" element={<RecommendationsTab />} />
            </Route>
          </Route>
          <Route path="recommenders" element={<RecommendersPage />} />
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
