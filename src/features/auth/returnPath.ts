/**
 * Where to go after signing in: the page the person was sent away from, if it is inside the app.
 * Anything else falls back to the dashboard so a crafted link can't send them elsewhere.
 */
export function returnPath(routerState: unknown): string {
  const from = (routerState as { from?: { pathname?: unknown; search?: unknown } } | null)?.from;
  const pathname = typeof from?.pathname === 'string' ? from.pathname : '';
  if (pathname !== '/app' && !pathname.startsWith('/app/')) return '/app';
  return pathname + (typeof from?.search === 'string' ? from.search : '');
}
