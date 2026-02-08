'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Building2, AlertCircle, UserX, Shield, Mail, ArrowRight } from 'lucide-react';
import { useJudgeAssignmentContext } from './components/judge-assignment-provider';

export default function JudgePage() {
  const { status, availableEvents, refresh } = useJudgeAssignmentContext();

  // Loading state
  if (status === 'loading') {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="space-y-6 md:space-y-8">
          <div className="text-center space-y-3">
            <div className="h-7 md:h-8 bg-muted animate-pulse rounded w-48 md:w-64 mx-auto" />
            <div className="h-5 md:h-6 bg-muted animate-pulse rounded w-64 md:w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 md:h-36 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not assigned to any events
  if (status === 'not-assigned') {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto min-h-full flex items-center justify-center">
        <div className="text-center space-y-4 md:space-y-6">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <UserX className="h-10 w-10 md:h-12 md:w-12 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Not Assigned to Event
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl md:max-w-2xl mx-auto px-4 md:px-0">
              You are not currently assigned to judge any active event. Please contact an
              administrator to request access.
            </p>
          </div>
          <div className="space-y-4 md:space-y-6">
            <Card className="p-4 md:p-6 max-w-sm md:max-w-md mx-auto bg-muted/30">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground text-sm md:text-base">
                      What this means
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                      Only judges assigned to an event can access the scoring interface for that
                      event.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground text-sm md:text-base">
                      Next steps
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                      Contact the event administrator to request access to a judging event.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            <Button onClick={() => refresh()} className="mx-auto">
              Check Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No active events exist
  if (status === 'no-event') {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto min-h-full flex items-center justify-center">
        <div className="text-center space-y-4 md:space-y-6">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
            <AlertCircle className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
          </div>
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">No Active Event</h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl md:max-w-2xl mx-auto px-4 md:px-0">
              There is currently no active event available for judging. Please contact an
              administrator to activate an event.
            </p>
          </div>
          <div className="space-y-4 md:space-y-6">
            <Card className="p-4 md:p-6 max-w-sm md:max-w-md mx-auto bg-muted/30">
              <div className="space-y-2 md:space-y-3">
                <h3 className="font-semibold text-foreground text-sm md:text-base">
                  What happens next?
                </h3>
                <ul className="text-xs md:text-sm text-muted-foreground space-y-1.5 md:space-y-2 text-left">
                  <li>• An administrator needs to activate an event</li>
                  <li>• Teams and criteria must be configured</li>
                  <li>• You&apos;ll be able to start judging once an event is active</li>
                </ul>
              </div>
            </Card>
            <Button onClick={() => refresh()} className="mx-auto">
              Check Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard: show event cards
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <Calendar className="h-8 w-8 md:h-10 md:w-10 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Events</h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            {availableEvents.length === 1
              ? 'You are assigned to the following active event. Click to start judging.'
              : `You are assigned to ${availableEvents.length} active events. Select one to start judging.`}
          </p>
        </div>

        {/* Event cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableEvents.map((event) => (
            <Link key={event.id} href={`/judge/event/${event.id}`}>
              <Card className="p-5 md:p-6 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:bg-primary/5 border-2 border-transparent h-full">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-base md:text-lg leading-tight">
                      {event.name}
                    </h3>
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                      Active
                    </Badge>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    {event.organizationName && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{event.organizationName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-primary font-medium ml-auto">
                      <span>Start Judging</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
