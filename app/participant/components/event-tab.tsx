'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Info, RefreshCw, Loader2 } from 'lucide-react';
import { useParticipantEvent } from '../contexts/participant-event-context';
import type { Event } from '@/lib/db/schema';

export function EventTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {events.map((event) => (
          <Card
            key={event.id}
            className={`transition-all cursor-pointer border-border/50 ${
              selectedEvent?.id === event.id ? 'ring-2 ring-primary' : 'hover:border-border'
            }`}
            onClick={() => handleSelectEvent(event)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    {event.name}
                    <Badge
                      variant={event.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {event.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/80 leading-relaxed">
                    {event.description}
                  </CardDescription>
                </div>
                {selectedEvent?.id === event.id && <Badge variant="outline">Selected</Badge>}
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

              <div className="flex items-center gap-4 pt-2 border-t border-border/30">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
