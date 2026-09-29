// Tabs on a program's page. Later phases add theirs here (requirements, documents, ...); the tab
// bar only appears once there is more than one. `to` is relative to /app/applications/:id.
export type ApplicationTab = { to: string; label: string; end?: boolean };

export const applicationTabs: readonly ApplicationTab[] = [
  { to: '', label: 'Overview', end: true },
];
