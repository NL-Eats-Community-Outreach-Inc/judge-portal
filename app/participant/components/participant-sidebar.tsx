'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getAllChallenges } from '../data/challenges';

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
  const challenges = getAllChallenges();

  const handleNavigation = (path: string) => {
    router.push(path);
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Extract current challenge ID from pathname
  const currentChallengeId = pathname?.includes('/challenge/')
    ? pathname.split('/challenge/')[1]
    : null;

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
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => handleNavigation('/participant')}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Participant Portal</h2>
            <p className="text-xs text-muted-foreground">Innovation Challenges</p>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Challenges section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Challenges
            </span>
            <Badge variant="secondary" className="text-xs">
              {challenges.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {challenges.map((challenge) => {
              const isActive = currentChallengeId === challenge.id;
              return (
                <Card
                  key={challenge.id}
                  className={cn(
                    'p-3 cursor-pointer transition-all duration-200 border hover:bg-muted/50',
                    isActive &&
                      'ring-2 ring-teal-500 ring-offset-2 ring-offset-background bg-teal-500/5'
                  )}
                  onClick={() => handleNavigation(`/participant/challenge/${challenge.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Trophy className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {challenge.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0',
                            challenge.status === 'Open'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                          )}
                        >
                          {challenge.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {challenge.teamsCount} teams
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
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
