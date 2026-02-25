'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, Calendar, Crown, Lock, LayoutDashboard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useParticipant } from '../contexts/participant-context';

interface ParticipantSidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ParticipantSidebar({
  isMobile = false,
  isOpen = false,
  onClose,
}: ParticipantSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { myTeams, registeredEvents, isLoading } = useParticipant();

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Extract current event ID from pathname
  const currentEventId = pathname?.includes('/event/')
    ? pathname.split('/event/')[1]?.split('/')[0]
    : null;

  const isDashboard = pathname === '/participant';

  const sidebarContent = (
    <aside
      className={cn(
        'bg-muted/30 border-r border-border flex flex-col h-full',
        !isMobile && 'w-64 lg:w-80'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handleNavigation('/participant')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-md shadow-teal-500/20">
            <Sparkles className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">Innovation Hub</h2>
            <p className="text-[11px] text-muted-foreground">Participant Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto p-3 space-y-5">
        {/* Dashboard link */}
        <div
          className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200',
            isDashboard
              ? 'bg-teal-500/10 text-teal-700 dark:text-teal-400'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
          onClick={() => handleNavigation('/participant')}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-teal-500" />
          </div>
        )}

        {/* My Teams section */}
        {!isLoading && (
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                My Teams
              </span>
              {myTeams.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 bg-teal-500/10 text-teal-700 dark:text-teal-400 border-0"
                >
                  {myTeams.length}
                </Badge>
              )}
            </div>

            {myTeams.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-3 italic">
                No teams yet. Join or create one!
              </p>
            ) : (
              <div className="space-y-1.5">
                {myTeams.map((team) => {
                  const isActive = currentEventId === team.eventId;
                  return (
                    <Card
                      key={team.id}
                      className={cn(
                        'p-2.5 cursor-pointer transition-all duration-200 border hover:bg-muted/50',
                        isActive &&
                          'ring-2 ring-teal-500/70 ring-offset-1 ring-offset-background bg-teal-500/5'
                      )}
                      onClick={() => handleNavigation(`/participant/event/${team.eventId}`)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500/15 to-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          {team.isCreator ? (
                            <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Users className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs text-foreground truncate">
                            {team.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground truncate">
                              {team.eventName}
                            </span>
                            {team.eventStatus === 'active' && (
                              <Lock className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">
                              {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Registered Events section */}
        {!isLoading && (
          <div>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Registered Events
              </span>
              {registeredEvents.length > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0"
                >
                  {registeredEvents.length}
                </Badge>
              )}
            </div>

            {registeredEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-3 italic">
                Browse events on the dashboard
              </p>
            ) : (
              <div className="space-y-1.5">
                {registeredEvents.map((event) => {
                  const isActive = currentEventId === event.id;
                  return (
                    <Card
                      key={event.id}
                      className={cn(
                        'p-2.5 cursor-pointer transition-all duration-200 border hover:bg-muted/50',
                        isActive &&
                          'ring-2 ring-teal-500/70 ring-offset-1 ring-offset-background bg-teal-500/5'
                      )}
                      onClick={() => handleNavigation(`/participant/event/${event.id}`)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/15 to-cyan-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs text-foreground truncate">
                            {event.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {event.organizationName && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                {event.organizationName}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[9px] px-1.5 py-0 h-4',
                                event.status === 'open'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              )}
                            >
                              {event.status === 'open' ? 'Open' : 'Active'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );

  // For mobile, wrap in Sheet component
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Participant Navigation</SheetTitle>
          </SheetHeader>
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  // For desktop, return sidebar directly
  return sidebarContent;
}
