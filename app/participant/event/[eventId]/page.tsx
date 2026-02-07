'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Trophy,
  Users,
  Target,
  Sparkles,
  Lock,
  Loader2,
  Rocket,
  KeyRound,
  Calendar,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useParticipant } from '../../contexts/participant-context';
import { CreateTeamDialog } from '../../components/create-team-dialog';
import { JoinTeamDialog } from '../../components/join-team-dialog';
import { TeamDetailPanel } from '../../components/team-detail-panel';

function getEventTags(name: string): string[] {
  const lower = name.toLowerCase();
  const tags: string[] = [];
  if (lower.includes('hack')) tags.push('Hackathon');
  if (lower.includes('innov')) tags.push('Innovation');
  if (lower.includes('ai') || lower.includes('ml')) tags.push('AI/ML');
  if (lower.includes('web')) tags.push('Web Dev');
  if (lower.includes('mobile')) tags.push('Mobile');
  if (lower.includes('data')) tags.push('Data');
  if (lower.includes('design')) tags.push('Design');
  if (lower.includes('iot')) tags.push('IoT');
  if (lower.includes('game')) tags.push('Gaming');
  if (lower.includes('sustain') || lower.includes('green')) tags.push('Sustainability');
  if (tags.length === 0) tags.push('Challenge');
  if (tags.length < 2) tags.push('Innovation');
  return tags.slice(0, 3);
}

const tagColors = [
  'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
];

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();
  const {
    events,
    isLoading,
    registerForEvent,
    unregisterFromEvent,
    getTeamForEvent,
    refreshAll,
  } = useParticipant();

  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);

  const event = events.find((e) => e.id === eventId);
  const team = getTeamForEvent(eventId);
  const tags = event ? getEventTags(event.name) : [];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          <span className="text-muted-foreground">Loading event...</span>
        </div>
      </div>
    );
  }

  // Event not found
  if (!event) {
    return (
      <div className="min-h-full">
        <div className="px-4 py-6 md:px-6 md:py-8 max-w-4xl mx-auto">
          <Link
            href="/participant"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Event Not Found</h2>
            <p className="text-muted-foreground">
              This event may no longer be available or the link may be incorrect.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isOpen = event.status === 'open';
  const isActive = event.status === 'active';

  const handleRegister = async () => {
    setIsRegistering(true);
    await registerForEvent(eventId);
    setIsRegistering(false);
  };

  const handleUnregister = async () => {
    setIsUnregistering(true);
    const success = await unregisterFromEvent(eventId);
    setIsUnregistering(false);
    if (success) {
      router.push('/participant');
    }
  };

  return (
    <div className="min-h-full">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-500/8 via-emerald-500/5 to-cyan-500/8 border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-teal-500/5 via-transparent to-transparent" />
        <div className="relative px-4 py-5 sm:py-6 md:px-6 md:py-8 max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/participant"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 sm:mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          {/* Event header */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
            <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Trophy className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={
                    isOpen
                      ? 'text-xs sm:text-sm font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : 'text-xs sm:text-sm font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  }
                >
                  {isOpen ? 'Open for Registration' : 'Judging In Progress'}
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
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">
                {event.name}
              </h1>
              {event.organizationName && (
                <p className="text-sm text-muted-foreground">
                  by <span className="font-medium text-foreground">{event.organizationName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4 sm:mt-5">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className={`text-xs sm:text-sm px-2.5 py-1 rounded-full font-medium ${tagColors[index % tagColors.length]}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 py-5 sm:py-6 md:px-6 md:py-8 max-w-4xl mx-auto">
        {/* Not registered state */}
        {!event.isRegistered && (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {/* Main content */}
            <div className="md:col-span-2 space-y-4 sm:space-y-6">
              <Card className="p-4 sm:p-5 md:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-500" />
                  About This Event
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {event.description ||
                    'An exciting innovation challenge awaits. Register to learn more about the event details, criteria, and start building with your team!'}
                </p>
              </Card>

              <Card className="p-4 sm:p-5 md:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-teal-500" />
                  Event Info
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      Max team size: {event.maxTeamSize || 'Unlimited'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Prize: TBA</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Started {new Date(event.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar CTA */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-teal-500/5 to-emerald-500/5 border-teal-500/15">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center">
                    <Rocket className="h-7 w-7 text-teal-600 dark:text-teal-400" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {isOpen ? 'Ready to Participate?' : 'View This Event'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isOpen
                      ? 'Register to create or join a team and start building your solution.'
                      : 'Register to follow this event and see results.'}
                  </p>
                  <Button
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md shadow-teal-500/20"
                    onClick={handleRegister}
                    disabled={isRegistering}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Registering...
                      </>
                    ) : (
                      'Register Now'
                    )}
                  </Button>
                </div>
              </Card>

              <Card className="p-4 sm:p-5 md:p-6 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/15">
                <div className="text-center">
                  <Sparkles className="h-7 w-7 mx-auto mb-2 text-amber-500" />
                  <p className="text-xs text-muted-foreground mb-1">Prize Pool</p>
                  <p className="text-xl font-bold text-foreground">TBA</p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Registered state */}
        {event.isRegistered && (
          <div className="space-y-4 sm:space-y-6">
            {/* Active event locked banner (no team) */}
            {isActive && !team && (
              <div className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Judging is in progress
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                    Team formation is closed. You can view the event but cannot create or join teams.
                  </p>
                </div>
              </div>
            )}

            {/* Has team — show team detail */}
            {team ? (
              <TeamDetailPanel teamId={team.id} />
            ) : isOpen ? (
              /* No team, event is open — show create/join options */
              <>
                <Card className="p-4 sm:p-5 md:p-6">
                  <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Target className="h-5 w-5 text-teal-500" />
                    About This Event
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {event.description ||
                      'An exciting innovation challenge. Create or join a team below to start participating!'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>Max team size: {event.maxTeamSize || 'Unlimited'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span>Prize: TBA</span>
                    </div>
                  </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Create Team Card */}
                  <Card
                    className="p-5 sm:p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/8 hover:-translate-y-0.5 border-2 border-dashed border-teal-500/20 hover:border-teal-500/40 bg-gradient-to-br from-teal-500/3 to-emerald-500/3"
                    onClick={() => setShowCreateTeam(true)}
                  >
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 flex items-center justify-center">
                        <Rocket className="h-7 w-7 text-teal-600 dark:text-teal-400" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1.5">Create a Team</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Start fresh and invite others with a join code
                      </p>
                    </div>
                  </Card>

                  {/* Join Team Card */}
                  <Card
                    className="p-5 sm:p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/8 hover:-translate-y-0.5 border-2 border-dashed border-cyan-500/20 hover:border-cyan-500/40 bg-gradient-to-br from-cyan-500/3 to-teal-500/3"
                    onClick={() => setShowJoinTeam(true)}
                  >
                    <div className="text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-teal-500/15 flex items-center justify-center">
                        <KeyRound className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <h3 className="font-semibold text-foreground mb-1.5">Join a Team</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Enter a 6-character code from your teammate
                      </p>
                    </div>
                  </Card>
                </div>

                {/* Unregister option */}
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleUnregister}
                    disabled={isUnregistering}
                  >
                    {isUnregistering ? 'Unregistering...' : 'Unregister from this event'}
                  </Button>
                </div>
              </>
            ) : (
              /* No team, event is active — read-only info */
              <Card className="p-4 sm:p-5 md:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-teal-500" />
                  About This Event
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {event.description ||
                    'This event is currently in the judging phase. Team formation has ended.'}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>Max team size: {event.maxTeamSize || 'Unlimited'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>Prize: TBA</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateTeamDialog
        eventId={eventId}
        eventName={event.name}
        open={showCreateTeam}
        onOpenChange={setShowCreateTeam}
        onSuccess={refreshAll}
      />
      <JoinTeamDialog
        open={showJoinTeam}
        onOpenChange={setShowJoinTeam}
        onSuccess={refreshAll}
      />
    </div>
  );
}
