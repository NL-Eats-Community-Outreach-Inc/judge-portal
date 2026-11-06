'use client';

import { useState } from 'react';
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
  const [isTabletSidebarOpen, setIsTabletSidebarOpen] = useState(false);

  return (
    <LearnerSearchProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Desktop navigation */}
          <LearnerDesktopNav />

          {/* Compact tablet navigation */}
          <LearnerTabletNav onExpand={() => setIsTabletSidebarOpen(true)} />

          {/* Expanded tablet navigation */}
          {isTabletSidebarOpen && (
            <div className="fixed inset-0 z-50 hidden md:block lg:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsTabletSidebarOpen(false)}
                className="absolute inset-0 bg-black/30"
              />

              <LearnerSidebar isOverlay isOpen onClose={() => setIsTabletSidebarOpen(false)} />
            </div>
          )}

          {/* Main application area */}
          <div className="min-h-screen md:ml-16 lg:ml-64">
            <div className="sticky top-0 z-30 border-b border-violet-200/70 bg-violet-50/90 backdrop-blur-md dark:border-violet-950 dark:bg-zinc-900/95">
              <AppHeader
                role="learner"
                title="Student Portal"
                subtitle="Continue your learning journey"
                email={user.email ?? null}
                settingsHref="/learner/settings"
              />
            </div>

            <main className="min-w-0 pb-24 md:pb-0">{children}</main>
          </div>

          {/* Mobile bottom navigation */}
          <LearnerMobileNav />
        </div>
      </TooltipProvider>
    </LearnerSearchProvider>
  );
}
