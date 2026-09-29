import { lazyComponent } from '@/lib/lazyComponent';

/** The whole signed-in app, one downloadable piece (the routes are in SignedInRoutes.tsx). */
export const SignedInApp = lazyComponent(() => import('./SignedInRoutes'));

/**
 * Starts downloading the app early, when a person is likely to need it (opening /app, or on the
 * sign-in page). A failure here is not reported: the screen that needs the code asks again.
 */
export function preloadSignedInApp(): void {
  SignedInApp.preload().catch(() => {});
}
