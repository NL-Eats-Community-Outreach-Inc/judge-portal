'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { apiFetch, messageOf } from '@/lib/api/client';

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
      const data = await apiFetch<{ events: ParticipantEvent[] }>('/api/participant/events');
      setEvents(data.events || []);
    } catch (error) {
      toast.error(messageOf(error, 'Failed to load events'));
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const data = await apiFetch<{ teams: ParticipantTeam[] }>('/api/participant/teams');
      setMyTeams(data.teams || []);
    } catch (error) {
      toast.error(messageOf(error, 'Failed to load teams'));
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
        await apiFetch(`/api/participant/events/${eventId}/register`, { method: 'POST' });
        toast.success('Registered successfully!');
        await refreshEvents();
        return true;
      } catch (error) {
        toast.error(messageOf(error, 'Failed to register'));
        return false;
      }
    },
    [refreshEvents]
  );

  const unregisterFromEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      try {
        await apiFetch(`/api/participant/events/${eventId}/register`, { method: 'DELETE' });
        toast.success('Unregistered from event');
        await refreshAll();
        return true;
      } catch (error) {
        toast.error(messageOf(error, 'Failed to unregister'));
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

  // The initial load is cancelled on unmount (or on a re-run) so a late
  // response never flips the loading flag of a provider that is gone
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchEvents(), fetchTeams()]);
      if (!cancelled) setIsLoading(false);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [fetchEvents, fetchTeams]);

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
