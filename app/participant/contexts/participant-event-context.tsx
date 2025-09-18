'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Event } from '@/lib/db/schema';

interface ParticipantEventContextType {
  selectedEvent: Event | null;
  setSelectedEvent: (event: Event | null) => void;
}

const ParticipantEventContext = createContext<ParticipantEventContextType | undefined>(undefined);

export function ParticipantEventProvider({ children }: { children: ReactNode }) {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  return (
    <ParticipantEventContext.Provider
      value={{
        selectedEvent,
        setSelectedEvent,
      }}
    >
      {children}
    </ParticipantEventContext.Provider>
  );
}

export function useParticipantEvent() {
  const context = useContext(ParticipantEventContext);
  if (context === undefined) {
    throw new Error('useParticipantEvent must be used within a ParticipantEventProvider');
  }
  return context;
}
