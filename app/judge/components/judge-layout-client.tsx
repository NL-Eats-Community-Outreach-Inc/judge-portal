'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { JudgeSidebar } from './judge-sidebar';
import { JudgeHeader } from './judge-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { JudgeAssignmentProvider } from './judge-assignment-provider';
import type { UserWithRole } from '@/lib/auth';

interface JudgeLayoutClientProps {
  user: UserWithRole;
  children: React.ReactNode;
}

export function JudgeLayoutClient({ user, children }: JudgeLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Extract eventId from URL path: /judge/event/[eventId]/*
  const eventIdMatch = pathname.match(/^\/judge\/event\/([^/]+)/);
  const eventId = eventIdMatch ? eventIdMatch[1] : null;
  const showSidebar = !!eventId;

  return (
    <JudgeAssignmentProvider eventId={eventId}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          {/* Desktop sidebar - only on event pages */}
          {showSidebar && (
            <div className="hidden md:block fixed left-0 top-0 h-full z-40">
              <JudgeSidebar />
            </div>
          )}

          {/* Mobile sidebar - only on event pages */}
          {showSidebar && (
            <div className="md:hidden">
              <JudgeSidebar
                isMobile={true}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          )}

          {/* Main content area */}
          <div className={showSidebar ? 'md:ml-64 lg:ml-80' : ''}>
            <div className="sticky top-0 z-30 bg-background">
              <JudgeHeader
                user={user}
                onMobileMenuToggle={showSidebar ? () => setIsMobileSidebarOpen(true) : undefined}
              />
            </div>
            <main>{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </JudgeAssignmentProvider>
  );
}
