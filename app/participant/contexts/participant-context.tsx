'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

export interface ParticipantEvent {
  id: string;
  name: string;
  description: string | null;
  status: 'open' | 'active';
  maxTeamSize: number | null;
  organizationName: string | null;
  createdAt: string;
  isRegistered: boolean;
  registeredAt: string | null;
  challengeType?: string;
  challengeTags?: string[];
  // Competition fields - only present when the event has been promoted to a competition
  title: string | null;
  shortDescription: string | null;
  prize: string | null;
  tags: string[] | null;
  deadline: string | null;
  country: string | null;
  challengeType: string | null;
}

export interface ParticipantTeam {
  id: string;
  name: string;
  description: string | null;
  demoUrl: string | null;
  repoUrl: string | null;
  eventId: string;
  eventName: string;
  eventStatus: string;
  joinCode: string;
  presentationOrder: number;
  awardType: string;
  isCreator: boolean;
  memberCount: number;
  maxTeamSize: number | null;
}

interface ParticipantContextType {
  events: ParticipantEvent[];
  myTeams: ParticipantTeam[];
  registeredEvents: ParticipantEvent[];
  isLoading: boolean;
  refreshEvents: () => Promise<void>;
  refreshTeams: () => Promise<void>;
  refreshAll: () => Promise<void>;
  registerForEvent: (eventId: string) => Promise<boolean>;
  unregisterFromEvent: (eventId: string) => Promise<boolean>;
  getTeamForEvent: (eventId: string) => ParticipantTeam | undefined;
  isRegisteredForEvent: (eventId: string) => boolean;
}

const ParticipantContext = createContext<ParticipantContextType | undefined>(undefined);

export function ParticipantProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<ParticipantEvent[]>([]);
  const [myTeams, setMyTeams] = useState<ParticipantTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/participant/events');
      const data = await response.json();
      if (response.ok) {
        setEvents(data.events || []);
      } else {
        throw new Error(data.error || 'Failed to load events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/participant/teams');
      const data = await response.json();
      if (response.ok) {
        setMyTeams(data.teams || []);
      } else {
        throw new Error(data.error || 'Failed to load teams');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    await fetchEvents();
  }, [fetchEvents]);

  const refreshTeams = useCallback(async () => {
    await fetchTeams();
  }, [fetchTeams]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchEvents(), fetchTeams()]);
  }, [fetchEvents, fetchTeams]);

  const registerForEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/participant/events/${eventId}/register`, {
          method: 'POST',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to register');
        }
        toast.success('Registered successfully!');
        await refreshEvents();
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to register');
        return false;
      }
    },
    [refreshEvents]
  );

  const unregisterFromEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/participant/events/${eventId}/register`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to unregister');
        }
        toast.success('Unregistered from event');
        await refreshAll();
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to unregister');
        return false;
      }
    },
    [refreshAll]
  );

  const getTeamForEvent = useCallback(
    (eventId: string) => myTeams.find((t) => t.eventId === eventId),
    [myTeams]
  );

  const isRegisteredForEvent = useCallback(
    (eventId: string) => events.some((e) => e.id === eventId && e.isRegistered),
    [events]
  );

  const registeredEvents = events.filter((e) => e.isRegistered);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchEvents(), fetchTeams()]);
      setIsLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ParticipantContext.Provider
      value={{
        events,
        myTeams,
        registeredEvents,
        isLoading,
        refreshEvents,
        refreshTeams,
        refreshAll,
        registerForEvent,
        unregisterFromEvent,
        getTeamForEvent,
        isRegisteredForEvent,
      }}
    >
      {children}
    </ParticipantContext.Provider>
  );
}

export function useParticipant() {
  const context = useContext(ParticipantContext);
  if (context === undefined) {
    throw new Error('useParticipant must be used within a ParticipantProvider');
  }
  return context;
}
