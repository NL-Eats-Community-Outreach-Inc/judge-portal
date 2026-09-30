import { Settings, Gavel, Users, Shield, type LucideIcon } from 'lucide-react';

/**
 * Role identity, expressed once. Every role area keeps its own accent (admin
 * blue, judge green, participant teal, super admin violet) but the class
 * strings live here, so headers, tabs and badges all read from one place.
 */
export type AppRole = 'admin' | 'judge' | 'participant' | 'super_admin';

export interface RoleTheme {
  /** Label shown in the header and role badge. */
  label: string;
  /** Icon in the header tile. */
  icon: LucideIcon;
  /** Accent text (links, icons). */
  accentText: string;
  /** Header icon tile background. */
  accentBg: string;
  /** Soft page background gradient behind the dashboard. */
  pageGradient: string;
  /** Active tab trigger. */
  activeTab: string;
  /** Role badge in the header user menu. */
  badge: string;
}

export const ROLE_THEME: Record<AppRole, RoleTheme> = {
  admin: {
    label: 'Admin',
    icon: Settings,
    accentText: 'text-blue-700 dark:text-blue-300',
    accentBg:
      'bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700 text-white',
    pageGradient:
      'bg-gradient-to-br from-gray-50/30 via-background to-slate-50/20 dark:from-gray-950/50 dark:via-background dark:to-gray-900/20',
    activeTab:
      'data-[state=active]:from-blue-50 data-[state=active]:via-indigo-50 data-[state=active]:to-blue-100 dark:data-[state=active]:from-blue-950/40 dark:data-[state=active]:via-indigo-950/40 dark:data-[state=active]:to-blue-900/40 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:border-blue-200/50 dark:data-[state=active]:border-blue-700/30',
    badge: 'capitalize',
  },
  judge: {
    label: 'Judge',
    icon: Gavel,
    accentText: 'text-emerald-700 dark:text-emerald-300',
    accentBg:
      'bg-gradient-to-r from-emerald-600 to-green-700 dark:from-emerald-500 dark:to-green-600 text-white',
    pageGradient:
      'bg-gradient-to-br from-emerald-50/30 via-background to-green-50/20 dark:from-emerald-950/20 dark:via-background dark:to-green-950/10',
    activeTab:
      'data-[state=active]:from-emerald-50 data-[state=active]:via-green-50 data-[state=active]:to-emerald-100 dark:data-[state=active]:from-emerald-950/40 dark:data-[state=active]:via-green-950/40 dark:data-[state=active]:to-emerald-900/40 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-200/50 dark:data-[state=active]:border-emerald-700/30',
    badge: 'capitalize',
  },
  participant: {
    label: 'Participant',
    icon: Users,
    accentText: 'text-teal-700 dark:text-teal-300',
    accentBg:
      'bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-500 dark:to-emerald-500 text-white',
    pageGradient:
      'bg-gradient-to-br from-teal-50/30 via-background to-emerald-50/20 dark:from-teal-950/20 dark:via-background dark:to-emerald-950/10',
    activeTab:
      'data-[state=active]:from-teal-50 data-[state=active]:via-emerald-50 data-[state=active]:to-teal-100 dark:data-[state=active]:from-teal-950/40 dark:data-[state=active]:via-emerald-950/40 dark:data-[state=active]:to-teal-900/40 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300 data-[state=active]:border-teal-200/50 dark:data-[state=active]:border-teal-700/30',
    badge: 'capitalize',
  },
  super_admin: {
    label: 'Super Admin',
    icon: Shield,
    accentText: 'text-violet-700 dark:text-violet-300',
    accentBg:
      'bg-gradient-to-r from-violet-600 to-purple-700 dark:from-violet-500 dark:to-purple-600 text-white',
    pageGradient:
      'bg-gradient-to-br from-violet-50/30 via-background to-purple-50/20 dark:from-violet-950/20 dark:via-background dark:to-purple-950/10',
    activeTab:
      'data-[state=active]:from-violet-50 data-[state=active]:via-purple-50 data-[state=active]:to-violet-100 dark:data-[state=active]:from-violet-950/40 dark:data-[state=active]:via-purple-950/40 dark:data-[state=active]:to-violet-900/40 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-300 data-[state=active]:border-violet-200/50 dark:data-[state=active]:border-violet-700/30',
    badge:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  },
};
