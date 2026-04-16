'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Users, ChevronRight, Sparkles, Zap, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { ParticipantEvent, ParticipantTeam } from '../contexts/participant-context';

interface EventCardProps {
  event: ParticipantEvent;
  team?: ParticipantTeam;
  onRegister: (eventId: string) => Promise<boolean>;
}

export function getEventTags(event: ParticipantEvent): string[] {
  const customTags: string[] = [];

  if (event.challengeType) {
    customTags.push(event.challengeType.charAt(0).toUpperCase() + event.challengeType.slice(1));
  }

  if (event.challengeTags && event.challengeTags.length > 0) {
    customTags.push(...event.challengeTags);
  } else {
    const lower = event.name.toLowerCase();
    if (lower.includes('hack')) customTags.push('Hackathon');
    if (lower.includes('innov')) customTags.push('Innovation');
    if (lower.includes('ai') || lower.includes('ml')) customTags.push('AI/ML');
    if (lower.includes('web')) customTags.push('Web Dev');
    if (lower.includes('mobile')) customTags.push('Mobile');
    if (lower.includes('data')) customTags.push('Data');
    if (lower.includes('design')) customTags.push('Design');
    if (lower.includes('iot')) customTags.push('IoT');
    if (lower.includes('game')) customTags.push('Gaming');
    if (lower.includes('sustain') || lower.includes('green')) customTags.push('Sustainability');

    // Only add defaults if we literally have just the challengeType
    if (customTags.length === 1) customTags.push('Challenge');
    if (customTags.length < 2) customTags.push('Open');
  }

  return Array.from(new Set(customTags)).slice(0, 3);
}

const tagColors = [
  'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
];

export function EventCard({ event, team, onRegister }: EventCardProps) {
  const [isRegistering, setIsRegistering] = useState(false);

  const tags = getEventTags(event);

  const handleRegister = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRegistering(true);
    await onRegister(event.id);
    setIsRegistering(false);
  };

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-xl hover:shadow-teal-500/8 dark:hover:shadow-teal-500/5 hover:-translate-y-1">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 opacity-80 group-hover:opacity-100 transition-opacity" />

      <Link href={`/participant/event/${event.id}`} className="block">
        <div className="p-4 sm:p-5 md:p-6">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={
                    event.status === 'open'
                      ? 'text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : 'text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  }
                >
                  {event.status === 'open' ? 'Open' : 'In Progress'}
                </Badge>
                {event.isRegistered && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Registered
                  </Badge>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2">
                {event.name}
              </h3>
              {event.organizationName && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                  by {event.organizationName}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 flex items-center justify-center">
              <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600 dark:text-teal-400" />
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">
            {event.description ||
              'An exciting challenge awaits. Register to learn more and participate!'}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${tagColors[index % tagColors.length]}`}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground mb-4">
            {event.maxTeamSize && (
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>Max {event.maxTeamSize} per team</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-medium text-foreground">Prize TBA</span>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            {team ? (
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-teal-500" />
                <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[150px]">
                  Team: {team.name}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {event.isRegistered ? 'Find or create a team' : 'Register to participate'}
                </span>
              </div>
            )}

            {!event.isRegistered ? (
              <Button
                size="sm"
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md shadow-teal-500/20 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
                onClick={handleRegister}
                disabled={isRegistering}
              >
                {isRegistering ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    Register
                    <ChevronRight className="h-3.5 w-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 border-teal-500/30 text-teal-700 dark:text-teal-400 hover:bg-teal-500/10"
              >
                View Event
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}
