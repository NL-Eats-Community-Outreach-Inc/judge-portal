'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PanelLeftOpen } from 'lucide-react';

import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';

import { LearnerSearchProvider } from '../learner/components/search/learner-search-provider';

import { ClassroomSidebar } from './classroom-sidebar';

import { ClassroomDesktopNav } from './navigation/classroom-desktop-nav';
import { ClassroomTabletNav } from './navigation/classroom-tablet-nav';
import { ClassroomMobileNav } from './navigation/classroom-mobile-nav';

import type { UserWithRole } from '@/lib/auth';

export type ClassroomRole = 'learner' | 'teacher';

interface ClassroomLayoutClientProps {
  user: UserWithRole;
  role: ClassroomRole;
  children: React.ReactNode;
}

const classroomConfig = {
  learner: {
    title: 'Student Portal',
    subtitle: 'Continue your learning journey',
    settingsHref: '/classroom/learner/settings',
    basePath: '/classroom/learner',
  },
  teacher: {
    title: 'Teacher Portal',
    subtitle: 'Manage your courses and lessons',
    settingsHref: '/classroom/teacher/settings',
    basePath: '/classroom/teacher',
  },
} satisfies Record<
  ClassroomRole,
  {
    title: string;
    subtitle: string;
    settingsHref: string;
    basePath: string;
  }
>;

export function ClassroomLayoutClient({ user, role, children }: ClassroomLayoutClientProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTabletSidebarOpen, setIsTabletSidebarOpen] = useState(false);

  const config = classroomConfig[role];

  // The learner lesson viewer has its own course navigation
  // and full-width layout.
  const isLessonPage =
    role === 'learner' &&
    /^\/classroom\/learner\/courses\/[^/]+\/module\/[^/]+\/lessons\/[^/]+\/?$/.test(pathname);

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <LearnerSearchProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {!isLessonPage && <ClassroomDesktopNav role={role} />}

          <ClassroomTabletNav role={role} onExpand={() => setIsTabletSidebarOpen(true)} />

          {isTabletSidebarOpen && (
            <div className="fixed inset-0 z-50 hidden md:block lg:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsTabletSidebarOpen(false)}
                className="absolute inset-0 bg-black/30"
              />

              <ClassroomSidebar
                role={role}
                isOverlay
                isOpen
                onClose={() => setIsTabletSidebarOpen(false)}
              />
            </div>
          )}

          {isLessonPage && isSidebarOpen && (
            <div className="fixed inset-0 z-50 hidden lg:block">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={closeSidebar}
                className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              />

              <ClassroomSidebar role={role} isOverlay isOpen onClose={closeSidebar} />
            </div>
          )}

          <div
            className={`min-h-screen ${isLessonPage ? 'md:ml-16 lg:ml-0' : 'md:ml-16 lg:ml-64'}`}
          >
            <div className="sticky top-0 z-30 flex min-w-0 items-center border-b border-violet-200/70 bg-violet-50/90 backdrop-blur-md dark:border-violet-950 dark:bg-zinc-900/95">
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
                  role={role}
                  title={config.title}
                  subtitle={config.subtitle}
                  email={user.email ?? null}
                  settingsHref={config.settingsHref}
                />
              </div>
            </div>

            <main className="min-w-0 pb-24 md:pb-0">{children}</main>
          </div>

          <ClassroomMobileNav role={role} />
        </div>
      </TooltipProvider>
    </LearnerSearchProvider>
  );
}
