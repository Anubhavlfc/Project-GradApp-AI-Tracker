import {
  Coins,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

// Only list pages that exist. Each later phase adds its own entry.
export const primaryNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/applications', label: 'Applications', icon: GraduationCap },
  { to: '/app/documents', label: 'Documents', icon: FileText },
  { to: '/app/recommenders', label: 'Recommenders', icon: Users },
  { to: '/app/funding', label: 'Funding', icon: Coins },
];
