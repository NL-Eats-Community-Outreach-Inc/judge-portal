'use client';

import { useState, useEffect, useCallback } from 'react';

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

export type AssignmentStatus = 'loading' | 'assigned' | 'not-assigned' | 'no-event';

interface JudgeAssignmentState {
  status: AssignmentStatus;
  event: Event | null;
  teams: Team[];
  scoreCompletion: ScoreCompletion[];
  error: string | null;
  isFullyComplete: boolean;
}

export function useJudgeAssignment() {
  const [state, setState] = useState<JudgeAssignmentState>({
    status: 'loading',
    event: null,
    teams: [],
    scoreCompletion: [],
    error: null,
    isFullyComplete: false,
  });

  // Fetch event data
  const fetchEvent = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/event');
      if (response.ok) {
        const data = await response.json();
        return { event: data.event, isAssigned: true };
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.errorType === 'NOT_ASSIGNED') {
          return { event: null, isAssigned: false };
        }
      }
      return { event: null, isAssigned: true };
    } catch (error) {
      console.error('Error fetching event:', error);
      return { event: null, isAssigned: true };
    }
  }, []);

  // Fetch teams data
  const fetchTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/teams');
      if (response.ok) {
        const data = await response.json();
        return { teams: data.teams || [], isAssigned: true };
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.errorType === 'NOT_ASSIGNED') {
          return { teams: [], isAssigned: false };
        }
      }
      return { teams: [], isAssigned: true };
    } catch (error) {
      console.error('Error fetching teams:', error);
      return { teams: [], isAssigned: true };
    }
  }, []);

  // Fetch score completion
  const fetchScoreCompletion = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/completion');
      if (response.ok) {
        const data = await response.json();
        return data.completion || [];
      } else if (response.status === 403) {
        // Not assigned - return empty completion
        return [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching completion:', error);
      return [];
    }
  }, []);

  // Main fetch function that determines assignment status
  const fetchAllData = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }));

    const [eventResult, teamsResult] = await Promise.all([fetchEvent(), fetchTeams()]);

    // Determine status based on API responses
    let status: AssignmentStatus;
    if (!eventResult.isAssigned || !teamsResult.isAssigned) {
      status = 'not-assigned';
    } else if (!eventResult.event || teamsResult.teams.length === 0) {
      status = 'no-event';
    } else {
      status = 'assigned';
    }

    // Fetch completion data if assigned
    let completion: ScoreCompletion[] = [];
    if (status === 'assigned') {
      completion = await fetchScoreCompletion();
    }

    // Check if fully complete - all teams are completed
    const isFullyComplete =
      status === 'assigned' &&
      teamsResult.teams.length > 0 &&
      completion.length > 0 &&
      completion.every((c: ScoreCompletion) => c.completed);

    setState({
      status,
      event: eventResult.event,
      teams: teamsResult.teams,
      scoreCompletion: completion,
      error: null,
      isFullyComplete,
    });
  }, [fetchEvent, fetchTeams, fetchScoreCompletion]);

  // Refresh score completion (for when scores are updated)
  const refreshScoreCompletion = useCallback(async () => {
    if (state.status === 'assigned') {
      const completion = await fetchScoreCompletion();

      // Check if fully complete after refresh
      const isFullyComplete =
        state.teams.length > 0 &&
        completion.length > 0 &&
        completion.every((c: ScoreCompletion) => c.completed);

      setState((prev) => ({
        ...prev,
        scoreCompletion: completion,
        isFullyComplete,
      }));
    }
  }, [state.status, state.teams.length, fetchScoreCompletion]);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    ...state,
    refresh: fetchAllData,
    refreshScoreCompletion,
  };
}
