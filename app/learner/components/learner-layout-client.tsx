'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeftOpen } from 'lucide-react';
import { LearnerSidebar } from './learner-sidebar';
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

  // The lesson player gets its own full-width layout.
  const isLessonPage = /^\/learner\/courses\/[^/]+\/module\/[^/]+\/lessons\/[^/]+\/?$/.test(
    pathname
  );

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Keep the normal desktop sidebar everywhere except the lesson player. */}
        {!isLessonPage && (
          <div className="fixed left-0 top-0 z-40 hidden h-full md:block">
            <LearnerSidebar />
          </div>
        )}

        {/* The original sidebar becomes an overlay drawer when opened. */}
        {isSidebarOpen && (
          <>
            <button
              type="button"
              aria-label="Close navigation"
              onClick={closeSidebar}
              className="fixed inset-0 z-40 cursor-default bg-black/40 backdrop-blur-[1px]"
            />

            <div className="fixed inset-y-0 left-0 z-50 h-full">
              <LearnerSidebar isMobile isOpen onClose={closeSidebar} />
            </div>
          </>
        )}

        <div className={`min-h-screen ${isLessonPage ? '' : 'md:ml-64'}`}>
          <div className="sticky top-0 z-30 flex min-w-0 items-center border-b border-violet-200/70 bg-violet-50/90 backdrop-blur-md dark:border-violet-950 dark:bg-zinc-900/95">
            {/* Desktop drawer toggle: shown on lesson pages only. */}
            {isLessonPage && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open portal navigation"
                title="Open portal navigation"
                className="ml-3 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                onMobileMenuToggle={() => setIsSidebarOpen(true)}
              />
            </div>
          </div>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
