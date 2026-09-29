// Tabs on a program's page. Later phases add theirs here (documents, recommendations, ...); the
// tab bar only appears once there is more than one. `to` is relative to /app/applications/:id.
export type ApplicationTab = { to: string; label: string; end?: boolean };

export const applicationTabs: readonly ApplicationTab[] = [
  { to: '', label: 'Overview', end: true },
  { to: 'requirements', label: 'Requirements' },
  { to: 'documents', label: 'Documents' },
  { to: 'recommendations', label: 'Recommendations' },
  { to: 'funding', label: 'Funding' },
  { to: 'tasks', label: 'Tasks' },
  { to: 'notes', label: 'Notes' },
];
