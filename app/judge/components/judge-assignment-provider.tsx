'use client';

import { createContext, useContext, ReactNode, useState } from 'react';
import { useJudgeAssignment, AssignmentStatus } from '@/lib/hooks/use-judge-assignment';

interface Event {
  id: string;
  name: string;
  description: string | null;
  status: 'setup' | 'active' | 'completed';
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
  refresh: () => Promise<void>;
  refreshScoreCompletion: () => Promise<void>;
}

const JudgeAssignmentContext = createContext<JudgeAssignmentContextType | undefined>(undefined);

export function JudgeAssignmentProvider({ children }: { children: ReactNode }) {
  const assignmentData = useJudgeAssignment();
  const [hasShownCompletionConfetti, setHasShownCompletionConfetti] = useState(false);

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
