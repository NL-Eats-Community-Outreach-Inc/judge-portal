'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Users,
  Target,
  Sparkles,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { getChallengeById } from '../../data/challenges';
import { toast } from 'sonner';

export default function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = use(params);
  const challenge = getChallengeById(challengeId);

  if (!challenge) {
    notFound();
  }

  const statusColors: Record<string, string> = {
    Open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    'Closing Soon': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    Closed: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
  };

  const tagColors = [
    'bg-teal-500/10 text-teal-700 dark:text-teal-400',
    'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  ];

  const handleRegister = () => {
    toast.info('Registration Coming Soon', {
      description: 'Team registration will be available in March 2026.',
    });
  };

  // Calculate days until deadline
  const daysUntilDeadline = Math.ceil(
    (new Date(challenge.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-full">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-cyan-500/10 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="relative px-4 py-6 md:px-6 md:py-8 max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/participant"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Challenges
          </Link>

          {/* Challenge header */}
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Trophy className="h-8 w-8 md:h-10 md:w-10 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className={`text-sm font-medium ${statusColors[challenge.status]}`}
                >
                  {challenge.status}
                </Badge>
                {daysUntilDeadline > 0 && daysUntilDeadline <= 7 && (
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                    <Clock className="h-3 w-3 mr-1" />
                    {daysUntilDeadline} days left
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {challenge.name}
              </h1>
              <p className="text-muted-foreground">
                Organized by{' '}
                <span className="font-medium text-foreground">{challenge.organizer}</span>
              </p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-6">
            {challenge.tags.map((tag, index) => (
              <span
                key={tag}
                className={`text-sm px-3 py-1.5 rounded-full font-medium ${tagColors[index % tagColors.length]}`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 py-6 md:px-6 md:py-8 max-w-4xl mx-auto">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main content column */}
          <div className="md:col-span-2 space-y-6">
            {/* Description */}
            <Card className="p-5 md:p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-teal-500" />
                About This Challenge
              </h2>
              <p className="text-muted-foreground leading-relaxed">{challenge.description}</p>
            </Card>

            {/* Judging Criteria */}
            <Card className="p-5 md:p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-500" />
                Judging Criteria
              </h2>
              <div className="space-y-4">
                {challenge.criteria.map((criterion) => (
                  <div key={criterion.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{criterion.name}</span>
                      <span className="text-sm text-muted-foreground">{criterion.weight}%</span>
                    </div>
                    <Progress value={criterion.weight} className="h-2" />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Teams will be evaluated based on these criteria by our panel of judges.
              </p>
            </Card>

            {/* Timeline */}
            <Card className="p-5 md:p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-teal-500" />
                Timeline
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Registration Open</p>
                    <p className="text-sm text-muted-foreground">Now accepting teams</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Submission Deadline</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(challenge.deadline).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-3 h-3 mt-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-muted-foreground">Judging & Results</p>
                    <p className="text-sm text-muted-foreground">To be announced</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Prize Card */}
            <Card className="p-5 md:p-6 bg-gradient-to-br from-orange-500/5 to-amber-500/5 border-orange-500/20">
              <div className="text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-orange-500" />
                <p className="text-sm text-muted-foreground mb-1">Prize Pool</p>
                <p className="text-2xl font-bold text-foreground">{challenge.prize}</p>
              </div>
            </Card>

            {/* Stats Card */}
            <Card className="p-5 md:p-6">
              <h3 className="font-semibold text-foreground mb-4">Challenge Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Teams Registered</span>
                  </div>
                  <span className="font-semibold text-foreground">{challenge.teamsCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Days Remaining</span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {daysUntilDeadline > 0 ? daysUntilDeadline : 'Closed'}
                  </span>
                </div>
              </div>
            </Card>

            {/* CTA Card */}
            <Card className="p-5 md:p-6">
              <h3 className="font-semibold text-foreground mb-2">Ready to Participate?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Register your team and start working on your innovative solution.
              </p>
              <Button
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md shadow-teal-500/20"
                onClick={handleRegister}
              >
                Register Team
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Team registration opens in March 2026
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
