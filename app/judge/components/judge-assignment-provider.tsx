'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useJudgeAssignment, AssignmentStatus } from '@/lib/hooks/use-judge-assignment';

interface Event {
  id: string;
  name: string;
  description: string | null;
  status: 'setup' | 'open' | 'active' | 'completed';
  organizationName?: string | null;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  presentationOrder: number;
}

interface ScoreCompletion {
  teamId: string;
  completed: boolean;
  partial: boolean;
}

interface JudgeAssignmentContextType {
  status: AssignmentStatus;
  event: Event | null;
  teams: Team[];
  scoreCompletion: ScoreCompletion[];
  error: string | null;
  isFullyComplete: boolean;
  hasShownCompletionConfetti: boolean;
  setHasShownCompletionConfetti: (shown: boolean) => void;
  availableEvents: Event[];
  refresh: () => Promise<void>;
  refreshScoreCompletion: () => Promise<void>;
}

const JudgeAssignmentContext = createContext<JudgeAssignmentContextType | undefined>(undefined);

interface JudgeAssignmentProviderProps {
  eventId?: string | null;
  children: ReactNode;
}

export function JudgeAssignmentProvider({ eventId, children }: JudgeAssignmentProviderProps) {
  const assignmentData = useJudgeAssignment(eventId);
  const [hasShownCompletionConfetti, setHasShownCompletionConfetti] = useState(false);

  // Reset confetti state when switching events so each event gets its own celebration
  useEffect(() => {
    setHasShownCompletionConfetti(false);
  }, [eventId]);

  return (
    <JudgeAssignmentContext.Provider
      value={{
        ...assignmentData,
        hasShownCompletionConfetti,
        setHasShownCompletionConfetti,
      }}
    >
      {children}
    </JudgeAssignmentContext.Provider>
  );
}

export function useJudgeAssignmentContext() {
  const context = useContext(JudgeAssignmentContext);
  if (!context) {
    throw new Error('useJudgeAssignmentContext must be used within JudgeAssignmentProvider');
  }
  return context;
}
