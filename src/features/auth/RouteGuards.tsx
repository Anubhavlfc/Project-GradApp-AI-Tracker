import { Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState, Skeleton, SkeletonRegion } from '@/components/ui';
import { KeyRound } from 'lucide-react';
import { returnPath } from './returnPath';
import { useAuth } from './useAuth';

export function AuthLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm items-center px-4">
      <SkeletonRegion label="Loading your account">
        <div className="w-80 space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </SkeletonRegion>
    </main>
  );
}

/** Shown instead of a blank page when the deployment has no Supabase settings. */
export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState
        as="h1"
        icon={KeyRound}
        title="Sign-in isn't set up yet"
        description="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment, then rebuild. The README explains where to find them."
      />
    </main>
  );
}

/** Only for signed-in users; everyone else is sent to the login page and brought back after. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'unconfigured') return <SetupRequired />;
  if (state.status === 'signed_out')
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** For login/sign-up pages: signed-in users skip straight to the app. */
export function GuestOnly() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'unconfigured') return <SetupRequired />;
  if (state.status === 'signed_in') return <Navigate to={returnPath(location.state)} replace />;
  return <Outlet />;
}
