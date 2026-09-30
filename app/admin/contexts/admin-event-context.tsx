'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { apiFetch, messageOf } from '@/lib/api/client';
import type { Event } from '@/lib/types';

interface AdminEventContextType {
  events: Event[];
  selectedEvent: Event | null;
  organizationName: string | null;
  isLoading: boolean;
  selectEvent: (event: Event | null) => void;
  refreshEvents: () => Promise<void>;
}

const AdminEventContext = createContext<AdminEventContextType | undefined>(undefined);

// The selection survives reloads so an admin never lands on a different event
// than the one they were working on.
const STORAGE_KEY = 'judgeportal.admin.selectedEventId';

function readStoredEventId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredEventId(eventId: string | null) {
  try {
    if (eventId) {
      window.localStorage.setItem(STORAGE_KEY, eventId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); the in-memory selection still works
  }
}

export function AdminEventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const selectedEventRef = useRef<Event | null>(null);
  selectedEventRef.current = selectedEvent;

  const fetchEvents = async () => {
    try {
      const data = await apiFetch<{ events: Event[]; organizationName: string | null }>(
        '/api/admin/event'
      );

      const loadedEvents: Event[] = data.events || [];
      setEvents(loadedEvents);
      setOrganizationName(data.organizationName ?? null);

      if (loadedEvents.length === 0) {
        setSelectedEvent(null);
        return;
      }

      // Keep the current selection, else the stored one, else the first active
      // event, else the first event
      const preferredId = selectedEventRef.current?.id ?? readStoredEventId();
      const preferred = preferredId ? loadedEvents.find((e) => e.id === preferredId) : undefined;
      const activeEvent = loadedEvents.find((e) => e.status === 'active');
      const next = preferred ?? activeEvent ?? loadedEvents[0];
      setSelectedEvent(next);
      writeStoredEventId(next.id);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error(messageOf(error, 'Failed to load events'));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshEvents = async () => {
    await fetchEvents();
  };

  const selectEvent = (event: Event | null) => {
    setSelectedEvent(event);
    writeStoredEventId(event?.id ?? null);
  };

  // Load once on mount; refreshEvents is the explicit re-fetch
  useEffect(() => {
    fetchEvents();
  }, []);

  const value: AdminEventContextType = {
    events,
    selectedEvent,
    organizationName,
    isLoading,
    selectEvent,
    refreshEvents,
  };

  return <AdminEventContext.Provider value={value}>{children}</AdminEventContext.Provider>;
}

export function useAdminEvent() {
  const context = useContext(AdminEventContext);
  if (context === undefined) {
    throw new Error('useAdminEvent must be used within an AdminEventProvider');
  }
  return context;
}
