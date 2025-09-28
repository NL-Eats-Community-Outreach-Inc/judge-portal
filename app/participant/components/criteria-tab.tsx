'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useParticipantEvent } from '../contexts/participant-event-context';
import type { Criterion } from '@/lib/db/schema';
import ReactMarkdown from 'react-markdown';

export function CriteriaTab() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { selectedEvent } = useParticipantEvent();

  const fetchCriteria = useCallback(
    async (isRefresh = false) => {
      if (!selectedEvent) return;

      if (!isRefresh) {
        setLoading(true);
      }
      try {
        const response = await fetch(`/api/participant/events/${selectedEvent.id}/criteria`);
        if (response.ok) {
          const data = await response.json();
          setCriteria(data);
        }
      } catch (error) {
        console.error('Failed to fetch criteria:', error);
      } finally {
        if (!isRefresh) {
          setLoading(false);
        }
      }
    },
    [selectedEvent]
  );

  useEffect(() => {
    if (selectedEvent) {
      fetchCriteria();
    } else {
      setCriteria([]);
    }
  }, [selectedEvent, fetchCriteria]);

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
    <div className="relative">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-foreground">Judging Criteria</h2>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <span className="flex-shrink-0">Criteria for</span>
              <span
                className="truncate max-w-[150px] sm:max-w-[250px] md:max-w-[350px] lg:max-w-[450px]"
                title={selectedEvent.name}
              >
                {selectedEvent.name}
              </span>
              <span className="flex-shrink-0">• {criteria.length} total criteria</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await fetchCriteria(true);
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
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
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-start gap-2">
                            <CardTitle className="text-lg break-words flex-1 min-w-0">
                              {criterion.name}
                            </CardTitle>
                            <Badge variant="outline" className="capitalize flex-shrink-0">
                              {criterion.category}
                            </Badge>
                          </div>
                          {criterion.description && (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed text-muted-foreground">
                              <ReactMarkdown
                                components={{
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => (
                                    <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>
                                  ),
                                  li: ({ children }) => <li className="mb-1">{children}</li>,
                                  strong: ({ children }) => (
                                    <strong className="font-semibold text-foreground">
                                      {children}
                                    </strong>
                                  ),
                                  em: ({ children }) => <em className="italic">{children}</em>,
                                  h1: ({ children }) => (
                                    <h1 className="text-lg font-semibold mb-2 text-foreground">
                                      {children}
                                    </h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="text-base font-semibold mb-2 text-foreground">
                                      {children}
                                    </h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-sm font-semibold mb-1 text-foreground">
                                      {children}
                                    </h3>
                                  ),
                                  code: ({ children }) => (
                                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                                      {children}
                                    </code>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-muted pl-4 italic">
                                      {children}
                                    </blockquote>
                                  ),
                                }}
                              >
                                {criterion.description}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                        {/* Redundant weight/score info - detailed version shown below
                        <div className="flex flex-col gap-1 text-right flex-shrink-0 min-w-fit">
                          <div className="flex items-center gap-2 justify-end">
                            <Badge variant="outline" className="capitalize hidden md:inline-flex">
                              {criterion.category}
                            </Badge>
                            <div className="text-sm font-semibold whitespace-nowrap">Weight: {criterion.weight}%</div>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            Score: {criterion.minScore}-{criterion.maxScore}
                          </div>
                        </div>
                        */}
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

      {/* Refresh overlay - positioned at the end to avoid layout shift */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Refreshing criteria...</span>
          </div>
        </div>
      )}
    </div>
  );
}
