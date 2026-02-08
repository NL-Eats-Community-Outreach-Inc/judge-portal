'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Crown, Lock, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ParticipantTeam } from '../contexts/participant-context';

interface TeamCardProps {
  team: ParticipantTeam;
}

export function TeamCard({ team }: TeamCardProps) {
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const isLocked = team.eventStatus === 'active';

  const handleCopyCode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      toast.success('Join code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  return (
    <Card
      className="group relative min-w-[260px] sm:min-w-[300px] md:min-w-[320px] snap-start overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/8 dark:hover:shadow-teal-500/5 hover:-translate-y-0.5 border-l-4 border-l-teal-500"
      onClick={() => router.push(`/participant/event/${team.eventId}`)}
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm sm:text-base text-foreground truncate">
                {team.name}
              </h4>
              {team.isCreator && <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground truncate">{team.eventName}</span>
              <Badge
                variant="outline"
                className={
                  isLocked
                    ? 'text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : 'text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                }
              >
                {isLocked ? (
                  <>
                    <Lock className="h-2 w-2 mr-0.5" />
                    Locked
                  </>
                ) : (
                  'Open'
                )}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {team.memberCount}/{team.maxTeamSize || '\u221E'}
            </span>
          </div>
          {team.isCreator && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              Creator
            </Badge>
          )}
        </div>

        {/* Join Code */}
        {!isLocked && (
          <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Code</span>
            <code className="text-xs sm:text-sm font-mono font-bold text-foreground tracking-widest flex-1">
              {team.joinCode}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-teal-500/10"
              onClick={handleCopyCode}
            >
              {copied ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
