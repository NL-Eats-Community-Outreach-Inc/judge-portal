'use client';

/**
 * Learner Sidebar — Responsive Navigation
 *
 * Renders the learner portal's navigation links and highlights the active section.
 *
 * This component:
 * 1. Defines the optional controls for desktop and mobile navigation.
 * 2. Detects the current route to determine the active navigation item.
 * 3. Configures the Dashboard and My Learning navigation links.
 * 4. Hides the mobile drawer when it is closed.
 * 5. Renders the portal branding and mobile close button.
 * 6. Displays navigation links with their corresponding icons and active states.
 *
 * Desktop navigation remains visible, while the mobile drawer can be dismissed
 * through the close button or a navigation link.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, GraduationCap, X } from 'lucide-react';

// 1. Define the optional controls used by the responsive sidebar.
interface LearnerSidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function LearnerSidebar({ isMobile = false, isOpen = false, onClose }: LearnerSidebarProps) {
  // 2. Use the current URL to determine which navigation item is active.
  const pathname = usePathname();

  // 3. Keep route metadata together so links, icons, and active states stay consistent.
  const navItems = [
    {
      label: 'Dashboard',
      href: '/learner',
      icon: LayoutDashboard,
      active: pathname === '/learner',
    },
    {
      label: 'My Learning',
      href: '/learner/courses',
      icon: BookOpen,
      active:
        pathname === '/learner/courses' ||
        pathname.startsWith('/learner/courses/') ||
        pathname.startsWith('/learner/lessons/'),
    },
  ];

  // 4. Hide a closed mobile drawer; desktop navigation remains visible.
  if (isMobile && !isOpen) return null;

  return (
    <aside
      className={[
        'flex h-full w-64 flex-col border-r',
        'border-violet-200/70 bg-violet-50/80',
        'dark:border-violet-950 dark:bg-zinc-900',
        isMobile ? 'fixed inset-y-0 left-0 z-50 shadow-xl' : '',
      ].join(' ')}
    >
      {/* 5. Show the portal branding and optional mobile close button. */}
      {/* Brand area: clicking the portal name returns to the learner dashboard. */}
      <div className="flex items-center justify-between border-b border-violet-200/70 p-4 dark:border-violet-950">
        <Link href="/learner" onClick={onClose} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">Innovation Hub</h2>
            <p className="text-[11px] text-muted-foreground">Student Portal</p>
          </div>
        </Link>

        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-2 transition hover:bg-violet-100 dark:hover:bg-violet-950"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* 6. Render the configured navigation links and their active states. */}
      {/* Render each route from the configuration above. */}
      <nav className="flex-1 space-y-5 overflow-auto p-3">
        <div>
          <p className="mb-2.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-violet-700/70 dark:text-violet-300/70">
            Learning
          </p>

          {navItems.map((item) => {
            // Render the icon component associated with this navigation item.
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                aria-current={item.active ? 'page' : undefined}
                className={[
                  'mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  item.active
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-violet-100 hover:text-violet-950 dark:hover:bg-violet-950 dark:hover:text-violet-100',
                ].join(' ')}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
