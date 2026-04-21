'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Loader2 } from 'lucide-react';

interface Competition {
  id: string;
  eventId: string;
  eventName: string;
  eventStatus: string;
  title: string | null;
  prize: string | null;
  tags: string[] | null;
  deadline: string | null;
  country: string | null;
  challengeType: string;
  shortDescription: string | null;
  participantSignupUrl: string | null;
}

export default function CompetitionOverview() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch('/api/admin/competitions');
        if (response.ok) {
          const data = await response.json();
          setCompetitions(data);
        }
      } catch (error) {
        console.error('Error fetching competitions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompetitions();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="text-center py-20">
        <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          No competitions yet. Promote an event to a competition from the Events tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Competitions</h2>
        <p className="text-sm text-muted-foreground">
          Overview of all events promoted to competitions.
        </p>
      </div>

      <div className="grid gap-4">
        {competitions.map((competition) => (
          <Card key={competition.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {competition.title || competition.eventName}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Event: {competition.eventName}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize shrink-0">
                  {competition.eventStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {competition.shortDescription && (
                <p className="text-sm text-muted-foreground">{competition.shortDescription}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Prize</p>
                  <p className="font-medium">{competition.prize || 'TBA'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Country</p>
                  <p className="font-medium">{competition.country || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Deadline</p>
                  <p className="font-medium">
                    {competition.deadline
                      ? new Date(competition.deadline).toLocaleDateString()
                      : 'TBA'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                  <p className="font-medium capitalize">{competition.challengeType}</p>
                </div>
              </div>

              {competition.tags && competition.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {competition.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {competition.participantSignupUrl ? (
                <a
                  href={competition.participantSignupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:underline"
                >
                  {competition.participantSignupUrl}
                </a>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
