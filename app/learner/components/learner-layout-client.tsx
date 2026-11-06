
'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeftOpen } from 'lucide-react';
import { LearnerSidebar } from './learner-sidebar';
import { LearnerSearchProvider } from './search/learner-search-provider';
import { LearnerDesktopNav } from './navigation/learner-desktop-nav';
import { LearnerTabletNav } from './navigation/learner-tablet-nav';
import { LearnerMobileNav } from './navigation/learner-mobile-nav';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { UserWithRole } from '@/lib/auth';

interface LearnerLayoutClientProps {
  user: UserWithRole;
  children: React.ReactNode;
}

export function LearnerLayoutClient({ user, children }: LearnerLayoutClientProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTabletSidebarOpen, setIsTabletSidebarOpen] = useState(false);

  // The lesson viewer has its own course navigation and full-width layout.
  const isLessonPage =
    /^\/learner\/courses\/[^/]+\/module\/[^/]+\/lessons\/[^/]+\/?$/.test(pathname);

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <LearnerSearchProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Desktop navigation stays hidden on lesson pages. */}
          {!isLessonPage && <LearnerDesktopNav />}

          {/* Compact tablet navigation. */}
          <LearnerTabletNav onExpand={() => setIsTabletSidebarOpen(true)} />

          {/* Expanded tablet navigation drawer. */}
          {isTabletSidebarOpen && (
            <div className="fixed inset-0 z-50 hidden md:block lg:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsTabletSidebarOpen(false)}
                className="absolute inset-0 bg-black/30"
              />

              <LearnerSidebar
                isOverlay
                isOpen
                onClose={() => setIsTabletSidebarOpen(false)}
              />
            </div>
          )}

          {/* Desktop lesson-page navigation drawer. */}
          {isLessonPage && isSidebarOpen && (
            <div className="fixed inset-0 z-50 hidden lg:block">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={closeSidebar}
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              />

              <LearnerSidebar isOverlay isOpen onClose={closeSidebar} />
            </div>
          )}

          {/* Main application area. */}
          <div
            className={`min-h-screen ${
              isLessonPage ? 'md:ml-16 lg:ml-0' : 'md:ml-16 lg:ml-64'
            }`}
          >
            <div className="sticky top-0 z-30 flex min-w-0 items-center border-b border-violet-200/70 bg-violet-50/90 backdrop-blur-md dark:border-violet-950 dark:bg-zinc-900/95">
              {/* Desktop drawer toggle for the full-width lesson viewer. */}
              {isLessonPage && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open portal navigation"
                  title="Open portal navigation"
                  className="ml-3 hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
                >
                  <PanelLeftOpen className="h-5 w-5" />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <AppHeader
                  role="learner"
                  title="Student Portal"
                  subtitle="Continue your learning journey"
                  email={user.email ?? null}
                  settingsHref="/learner/settings"
                />
              </div>
            </div>

            <main className="min-w-0 pb-24 md:pb-0">{children}</main>
          </div>

          {/* Mobile bottom navigation. */}
          <LearnerMobileNav />
        </div>
      </TooltipProvider>
    </LearnerSearchProvider>
  );
}
