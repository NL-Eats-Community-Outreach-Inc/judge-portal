'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useParticipantEvent } from '../contexts/participant-event-context';
import type { Criterion } from '@/lib/db/schema';

export function CriteriaTab() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { selectedEvent } = useParticipantEvent();

  useEffect(() => {
    if (selectedEvent) {
      fetchCriteria();
    } else {
      setCriteria([]);
    }
  }, [selectedEvent]);

  const fetchCriteria = async () => {
    if (!selectedEvent) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/participant/events/${selectedEvent.id}/criteria`);
      if (response.ok) {
        const data = await response.json();
        setCriteria(data);
      }
    } catch (error) {
      console.error('Failed to fetch criteria:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedCriteria = criteria.reduce(
    (acc, criterion) => {
      const category = criterion.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(criterion);
      return acc;
    },
    {} as Record<string, Criterion[]>
  );

  if (!selectedEvent) {
    return (
      <Card>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p>No event selected</p>
            <p className="text-sm">Select an event to view its criteria</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-4 bg-muted rounded w-full mb-2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (criteria.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold mb-2 text-foreground">No Criteria Available</h3>
          <p className="text-muted-foreground max-w-sm">
            This event doesn&apos;t have any judging criteria set up yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Judging Criteria</h2>
          <p className="text-muted-foreground">
            Criteria for {selectedEvent.name} • {criteria.length} total criteria
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            setIsRefreshing(true);
            try {
              await fetchCriteria();
            } finally {
              setIsRefreshing(false);
            }
          }}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {Object.entries(groupedCriteria).map(([category, categoryCriteria]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold capitalize text-foreground">
              {category} Criteria
            </h3>
            <Badge variant="secondary">{categoryCriteria.length} criteria</Badge>
          </div>

          <div className="grid gap-4">
            {categoryCriteria
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((criterion) => (
                <Card key={criterion.id} className="border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-3 text-lg">
                          {criterion.name}
                          <Badge variant="outline" className="capitalize">
                            {criterion.category}
                          </Badge>
                        </CardTitle>
                        {criterion.description && (
                          <CardDescription>{criterion.description}</CardDescription>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <div className="text-sm font-semibold">Weight: {criterion.weight}%</div>
                        <div className="text-xs text-muted-foreground">
                          Score: {criterion.minScore}-{criterion.maxScore}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Weight Distribution</span>
                        <span>{criterion.weight}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${criterion.weight}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">
                            Minimum Score
                          </span>
                          <div className="text-lg font-bold text-foreground">
                            {criterion.minScore}
                          </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <span className="text-xs text-muted-foreground block mb-1">
                            Maximum Score
                          </span>
                          <div className="text-lg font-bold text-foreground">
                            {criterion.maxScore}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
