'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  Calendar,
  Users,
  Target,
  ChevronRight,
  Sparkles,
  Clock,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { getAllChallenges, getChallengeById, type Challenge } from './data/challenges';

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const statusColors: Record<string, string> = {
    Open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    'Closing Soon':
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    Closed: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
  };

  const tagColors = [
    'bg-teal-500/10 text-teal-700 dark:text-teal-400',
    'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  ];

  return (
    <Card className="group relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-teal-500/10 dark:hover:shadow-teal-500/5 hover:-translate-y-1">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500" />

      <div className="p-5 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={`text-xs font-medium ${statusColors[challenge.status]}`}
              >
                {challenge.status}
              </Badge>
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-foreground group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-2">
              {challenge.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{challenge.organizer}</p>
          </div>
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center">
            <Trophy className="h-6 w-6 md:h-7 md:w-7 text-teal-600 dark:text-teal-400" />
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {challenge.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {challenge.tags.slice(0, 4).map((tag, index) => (
            <span
              key={tag}
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${tagColors[index % tagColors.length]}`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{challenge.teamsCount} teams</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>Due {new Date(challenge.deadline).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Prize and CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span className="font-semibold text-foreground">{challenge.prize}</span>
          </div>
          <Link href={`/participant/challenge/${challenge.id}`}>
            <Button
              size="sm"
              className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md shadow-teal-500/20 group/btn"
            >
              View Details
              <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function ParticipantContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const challengeId = searchParams.get('challenge');

  const challenges = getAllChallenges();
  const challengeExists = challengeId ? getChallengeById(challengeId) !== undefined : false;

  // Redirect to challenge detail page if valid challenge parameter is present
  useEffect(() => {
    if (challengeId && challengeExists) {
      router.replace(`/participant/challenge/${challengeId}`);
    }
  }, [challengeId, challengeExists, router]);

  // Show loading while redirecting (only for valid challenges)
  if (challengeId && challengeExists) {
    return (
      <div className="min-h-full flex items-center justify-center py-20">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
          <span className="text-muted-foreground">Redirecting to challenge...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Hero section with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-500/5 via-emerald-500/5 to-cyan-500/5 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative px-4 py-8 md:px-6 md:py-12 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Innovation Challenges
              </h1>
              <p className="text-sm text-muted-foreground">
                Explore opportunities and showcase your ideas
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/5 border border-border/50 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">{challenges.length} Active Challenges</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/5 border border-border/50 backdrop-blur-sm">
              <Users className="h-4 w-4 text-teal-500" />
              <span className="text-sm font-medium">
                {challenges.reduce((sum, c) => sum + c.teamsCount, 0)} Teams Participating
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 py-6 md:px-6 md:py-8 max-w-5xl mx-auto">
        {/* Challenge grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.id} challenge={challenge} />
          ))}
        </div>

        {/* Empty state */}
        {challenges.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Active Challenges
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are currently no innovation challenges available. Check back soon for new
              opportunities!
            </p>
          </div>
        )}

        {/* Coming soon section */}
        <div className="mt-12 text-center">
          <Card className="p-6 md:p-8 bg-gradient-to-br from-slate-500/5 to-slate-500/10 border-dashed">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-slate-500/10 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">More Features Coming</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Team registration, project submissions, and real-time judging progress will be
              available soon. Stay tuned!
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-full flex items-center justify-center py-20">
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
        <span className="text-muted-foreground">Loading challenges...</span>
      </div>
    </div>
  );
}

export default function ParticipantPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ParticipantContent />
    </Suspense>
  );
}
