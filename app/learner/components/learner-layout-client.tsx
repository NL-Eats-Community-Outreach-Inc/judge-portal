'use client';

import { useState } from 'react';
import { LearnerSidebar } from './learner-sidebar';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { UserWithRole } from '@/lib/auth';

interface LearnerLayoutClientProps {
  user: UserWithRole;
  children: React.ReactNode;
}

export function LearnerLayoutClient({ user, children }: LearnerLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="fixed left-0 top-0 z-40 hidden h-full md:block">
          <LearnerSidebar />
        </div>

        <div className="md:hidden">
          <LearnerSidebar
            isMobile
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        </div>

        <div className="min-h-screen md:ml-64">
          <div className="sticky top-0 z-30 border-b border-violet-200/70 bg-violet-50/90 backdrop-blur-md dark:border-violet-950 dark:bg-zinc-900/95">
            <AppHeader
              role="learner"
              title="Student Portal"
              subtitle="Continue your learning journey"
              email={user.email ?? null}
              settingsHref="/learner/settings"
              onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
            />
          </div>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
