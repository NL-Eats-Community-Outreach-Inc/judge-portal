'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Calendar,
  Clock,
  Info,
  RefreshCw,
  Loader2,
  Eye,
  Users,
  FileText,
  Shield,
  CalendarDays,
  X,
} from 'lucide-react';
import { useParticipantEvent } from '../contexts/participant-event-context';
import type { Event } from '@/lib/db/schema';

export function EventTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sheetEvent, setSheetEvent] = useState<Event | null>(null);
  const { selectedEvent, setSelectedEvent } = useParticipantEvent();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/participant/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event: Event) => {
    // Toggle selection: if already selected, deselect; otherwise select
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
    } else {
      setSelectedEvent(event);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isRegistrationOpen = (event: Event) => {
    if (!event.registrationOpen) return false;
    if (!event.registrationCloseAt) return true;
    return new Date(event.registrationCloseAt) > new Date();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
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

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold mb-2 text-foreground">No Events Available</h3>
          <p className="text-muted-foreground max-w-sm">
            There are currently no events available for participation. Please check back later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Select an event to view criteria and manage your team
            </span>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await fetchEvents();
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4">
          {events.map((event) => (
            <Card
              key={event.id}
              className={`transition-all duration-300 cursor-pointer border-border/50 ${
                selectedEvent?.id === event.id
                  ? 'bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-purple-50/80 dark:from-blue-950/10 dark:via-slate-900/20 dark:to-indigo-950/10 ring-2 ring-blue-400 dark:ring-blue-600/40 shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 transform scale-[1.02] border-blue-200 dark:border-blue-800/30'
                  : 'hover:border-border hover:shadow-md hover:bg-gradient-to-br hover:from-muted/30 hover:to-muted/20 hover:scale-[1.01] transform'
              }`}
              onClick={() => handleSelectEvent(event)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      {event.name}
                      <Badge variant="secondary" className="capitalize">
                        {event.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground/80 leading-relaxed">
                      {event.description}
                    </CardDescription>
                  </div>
                  {selectedEvent?.id === event.id && (
                    <Badge className="bg-blue-500 text-white border-0 shadow-sm animate-in fade-in-0 zoom-in-95 duration-200 pointer-events-none">
                      ✓ Selected
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Created {formatDate(event.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Updated {formatDate(event.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Registration:</span>
                      <Badge variant={isRegistrationOpen(event) ? 'default' : 'secondary'}>
                        {isRegistrationOpen(event) ? 'Open' : 'Closed'}
                      </Badge>
                    </div>
                    {event.registrationCloseAt && isRegistrationOpen(event) && (
                      <div className="text-sm text-muted-foreground">
                        Closes {formatDate(event.registrationCloseAt)}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSheetEvent(event);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Sheet open={!!sheetEvent} onOpenChange={(open) => !open && setSheetEvent(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
            {sheetEvent && (
              <>
                {/* Gradient Header Section */}
                <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 p-8 border-b border-border/30">
                  {/* Close Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSheetEvent(null)}
                    className="absolute right-4 top-4 h-8 w-8 rounded-full hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>

                  <SheetHeader className="space-y-4 pr-8">
                    <div>
                      <SheetTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
                        {sheetEvent.name}
                      </SheetTitle>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Badge
                        variant="secondary"
                        className="capitalize bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-border/50"
                      >
                        {sheetEvent.status}
                      </Badge>
                      <Badge
                        variant={isRegistrationOpen(sheetEvent) ? 'default' : 'secondary'}
                        className={
                          isRegistrationOpen(sheetEvent)
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : ''
                        }
                      >
                        Registration {isRegistrationOpen(sheetEvent) ? 'Open' : 'Closed'}
                      </Badge>
                    </div>
                  </SheetHeader>
                </div>

                <div className="p-6 space-y-6">
                  {/* Event Overview Card */}
                  {/* <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card/95 to-muted/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </div>
                      Event Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/70 transition-colors">
                      <span className="text-sm text-muted-foreground">Event Status</span>
                      <span className="text-sm font-medium capitalize">{sheetEvent.status}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/70 transition-colors">
                      <span className="text-sm text-muted-foreground">Event Type</span>
                      <span className="text-sm font-medium">Competition Event</span>
                    </div>
                  </CardContent>
                </Card> */}

                  {/* Event Description Card */}
                  {sheetEvent.description && (
                    <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card/95 to-muted/10">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          Event Description
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {sheetEvent.description}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Timeline Card */}
                  <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card/95 to-cyan-50/10 dark:to-cyan-950/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </div>
                        Event Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 p-3 rounded-lg bg-gradient-to-r from-muted/20 to-muted/30 hover:from-muted/50 hover:to-muted/60 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1">Created</p>
                            <p className="text-sm font-medium">
                              {new Date(sheetEvent.createdAt).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <div className="flex-1 p-3 rounded-lg bg-gradient-to-r from-muted/20 to-muted/30 hover:from-muted/50 hover:to-muted/60 transition-colors">
                            <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                            <p className="text-sm font-medium">
                              {new Date(sheetEvent.updatedAt).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Team Configuration Card */}
                  <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card via-card/95 to-purple-50/10 dark:to-purple-950/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        Team Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/70 transition-colors">
                        <span className="text-sm text-muted-foreground">Maximum Team Size</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{sheetEvent.maxTeamSize}</span>
                          <span className="text-sm text-muted-foreground">members</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/70 transition-colors">
                        <span className="text-sm text-muted-foreground">Registration Status</span>
                        <Badge
                          variant={isRegistrationOpen(sheetEvent) ? 'default' : 'secondary'}
                          className={
                            isRegistrationOpen(sheetEvent)
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : ''
                          }
                        >
                          {isRegistrationOpen(sheetEvent) ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      {sheetEvent.registrationCloseAt && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/70 transition-colors">
                          <span className="text-sm text-muted-foreground">
                            {isRegistrationOpen(sheetEvent)
                              ? 'Registration Closes'
                              : 'Registration Closed'}
                          </span>
                          <span className="text-sm font-medium">
                            {new Date(sheetEvent.registrationCloseAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Resources Card (Placeholder) */}
                  <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card/50 via-card/30 to-muted/20 border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2 text-muted-foreground/70">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        Resources
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground/60 italic">
                        Event resources and documentation will be available here
                      </p>
                    </CardContent>
                  </Card>

                  {/* Access & Permissions Card (Placeholder) */}
                  <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card/50 via-card/30 to-muted/20 border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2 text-muted-foreground/70">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                        </div>
                        Access & Permissions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground/60 italic">
                        Access control and permission details will be shown here
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Refresh overlay - positioned at the end to avoid layout shift */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-background/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-background/95 backdrop-blur-md border border-border/50 rounded-lg px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">Refreshing events...</span>
          </div>
        </div>
      )}
    </div>
  );
}
