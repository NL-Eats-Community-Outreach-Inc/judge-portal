'use client';

/**
 * Learner Layout Client — Shared Learner Interface
 *
 * Provides the shared navigation and header surrounding learner pages.
 *
 * This component:
 * 1. Defines the props for the authenticated user and active page content.
 * 2. Manages the mobile sidebar's open and closed state.
 * 3. Renders persistent desktop navigation and conditional mobile navigation.
 * 4. Configures the shared application header with learner-specific details.
 * 5. Renders the active learner page inside the shared layout.
 *
 * The desktop sidebar remains visible, while the mobile sidebar can be opened
 * and closed through the header and sidebar controls.
 */

import { useState } from 'react';
import { LearnerSidebar } from './learner-sidebar';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { UserWithRole } from '@/lib/auth';

// 1. Define the authenticated user and page content required by the layout.
interface LearnerLayoutClientProps {
  user: UserWithRole;
  children: React.ReactNode;
}

export function LearnerLayoutClient({ user, children }: LearnerLayoutClientProps) {
  // 2. Keep the mobile sidebar closed by default.
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* 3. Keep desktop navigation visible at medium screen sizes and above. */}
        <div className="fixed left-0 top-0 z-40 hidden h-full md:block">
          <LearnerSidebar />
        </div>

        {/* 4. Render the mobile sidebar with shared open and close state. */}
        <div className="md:hidden">
          <LearnerSidebar
            isMobile
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        </div>

        <div className="min-h-screen md:ml-64">
          <div className="sticky top-0 z-30 border-b border-violet-200/70 bg-violet-50/90 backdrop-blur-md dark:border-violet-950 dark:bg-zinc-900/95">
            {/* 5. Configure the shared header for the learner portal. */}
            <AppHeader
              role="learner"
              title="Student Portal"
              subtitle="Continue your learning journey"
              email={user.email ?? null}
              settingsHref="/learner/settings"
              onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
            />
          </div>

          {/* 6. Render the active learner page inside the shared layout region. */}
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
