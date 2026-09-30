'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { JudgeSidebar } from './judge-sidebar';
import { AppHeader } from '@/components/app-header';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { JudgeAssignmentProvider, useJudgeAssignmentContext } from './judge-assignment-provider';
import type { UserWithRole } from '@/lib/auth';

interface JudgeLayoutClientProps {
  user: UserWithRole;
  children: React.ReactNode;
}

function statusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case 'setup':
      return <Badge variant="secondary">Setup</Badge>;
    case 'completed':
      return <Badge variant="outline">Completed</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

const AMBER_BADGE =
  'text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400 text-xs shrink-0';

/** Header copy follows the judge's assignment state for the current URL. */
function JudgeHeader({
  email,
  onMobileMenuToggle,
}: {
  email: string | null;
  onMobileMenuToggle?: () => void;
}) {
  const pathname = usePathname();
  const { status, event } = useJudgeAssignmentContext();

  const backNav = pathname?.startsWith('/judge/settings')
    ? { label: 'Dashboard', href: '/judge' }
    : pathname?.startsWith('/judge/event/')
      ? { label: 'All Events', href: '/judge' }
      : null;

  let title: string;
  let subtitle: string | undefined;
  let titleAddon: React.ReactNode = null;
  if (status === 'loading') {
    title = 'Loading…';
  } else if (status === 'dashboard') {
    title = 'Judge Dashboard';
    subtitle = 'Select an event to start judging';
  } else if (status === 'not-assigned') {
    title = 'Not Assigned to Event';
    subtitle = 'Contact administrator for event access';
    titleAddon = (
      <Badge variant="outline" className={AMBER_BADGE}>
        Not Assigned
      </Badge>
    );
  } else if (event) {
    title = event.name;
    titleAddon = statusBadge(event.status);
  } else {
    title = 'No Active Event';
    subtitle = 'No event is currently active for judging';
    titleAddon = (
      <Badge variant="outline" className={AMBER_BADGE}>
        Inactive
      </Badge>
    );
  }

  return (
    <AppHeader
      role="judge"
      title={title}
      subtitle={subtitle}
      titleAddon={titleAddon}
      email={email}
      settingsHref="/judge/settings"
      backNav={backNav ?? undefined}
      onMobileMenuToggle={onMobileMenuToggle}
    />
  );
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
                email={user.email ?? null}
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
