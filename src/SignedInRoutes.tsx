import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton, SkeletonRegion } from '@/components/ui';
import { DashboardPage } from '@/pages/DashboardPage';
import { DeadlinesPage } from '@/pages/DeadlinesPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { FundingPage } from '@/pages/FundingPage';
import { ApplicationLayout } from '@/pages/applications/ApplicationLayout';
import { ApplicationsPage } from '@/pages/applications/ApplicationsPage';
import { DocumentsTab } from '@/pages/applications/DocumentsTab';
import { EditApplicationPage } from '@/pages/applications/EditApplicationPage';
import { FundingTab } from '@/pages/applications/FundingTab';
import { NewApplicationPage } from '@/pages/applications/NewApplicationPage';
import { NotesTab } from '@/pages/applications/NotesTab';
import { OverviewTab } from '@/pages/applications/OverviewTab';
import { RecommendationsTab } from '@/pages/applications/RecommendationsTab';
import { RequirementsTab } from '@/pages/applications/RequirementsTab';
import { TasksTab } from '@/pages/applications/TasksTab';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RecommendersPage } from '@/pages/RecommendersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TasksPage } from '@/pages/TasksPage';

// Component gallery for development only; compiled out of production builds.
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/DesignSystemPage'))
  : null;

/**
 * Everything behind sign-in. It is downloaded as one piece, after the sign-in check, so the
 * landing page and the sign-in forms do not carry the code of the whole app (see `signedIn.ts`).
 * The routes here are relative to `/app`.
 */
export default function SignedInRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="applications">
          <Route index element={<ApplicationsPage />} />
          <Route path="new" element={<NewApplicationPage />} />
          <Route path=":applicationId/edit" element={<EditApplicationPage />} />
          <Route path=":applicationId" element={<ApplicationLayout />}>
            <Route index element={<OverviewTab />} />
            <Route path="requirements" element={<RequirementsTab />} />
            <Route path="documents" element={<DocumentsTab />} />
            <Route path="recommendations" element={<RecommendationsTab />} />
            <Route path="funding" element={<FundingTab />} />
            <Route path="tasks" element={<TasksTab />} />
            <Route path="notes" element={<NotesTab />} />
          </Route>
        </Route>
        <Route path="deadlines" element={<DeadlinesPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="recommenders" element={<RecommendersPage />} />
        <Route path="funding" element={<FundingPage />} />
        <Route path="settings" element={<SettingsPage />} />
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
