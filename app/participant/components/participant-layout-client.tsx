'use client';

import { useState } from 'react';
import { ParticipantSidebar } from './participant-sidebar';
import { ParticipantHeader } from './participant-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { UserWithRole } from '@/lib/auth';

interface ParticipantLayoutClientProps {
  user: UserWithRole;
  children: React.ReactNode;
}

export function ParticipantLayoutClient({ user, children }: ParticipantLayoutClientProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar - hidden on mobile, visible on desktop */}
        <div className="hidden md:block fixed left-0 top-0 h-full z-40">
          <ParticipantSidebar />
        </div>

        {/* Mobile sidebar - only visible on mobile */}
        <div className="md:hidden">
          <ParticipantSidebar
            isMobile={true}
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
        </div>

        {/* Main content area */}
        <div className="md:ml-64 lg:ml-80">
          <div className="sticky top-0 z-30 bg-background">
            <ParticipantHeader user={user} onMobileMenuToggle={() => setIsMobileSidebarOpen(true)} />
          </div>
          <main>{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
