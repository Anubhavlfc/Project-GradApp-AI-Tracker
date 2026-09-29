import { Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AuthLoading, GuestOnly, RequireAuth } from '@/features/auth/RouteGuards';
import { LandingPage } from '@/pages/LandingPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SignedInApp } from '@/signedIn';

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
        {/* The app's code is fetched only after the sign-in check; the same skeleton covers both. */}
        <Route
          path="/app/*"
          element={
            <Suspense fallback={<AuthLoading />}>
              <SignedInApp />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
