'use client';

import { useState, useEffect, useCallback } from 'react';

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

export type AssignmentStatus = 'loading' | 'assigned' | 'not-assigned' | 'no-event' | 'dashboard';

interface JudgeAssignmentState {
  status: AssignmentStatus;
  event: Event | null;
  teams: Team[];
  scoreCompletion: ScoreCompletion[];
  error: string | null;
  isFullyComplete: boolean;
  availableEvents: Event[];
}

export function useJudgeAssignment(eventId?: string | null) {
  const [state, setState] = useState<JudgeAssignmentState>({
    status: 'loading',
    event: null,
    teams: [],
    scoreCompletion: [],
    error: null,
    isFullyComplete: false,
    availableEvents: [],
  });

  // Fetch available events for dashboard mode
  const fetchAvailableEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/judge/events');
      if (response.ok) {
        const data = await response.json();
        return (data.events || []) as Event[];
      }
      return [] as Event[];
    } catch (error) {
      console.error('Error fetching available events:', error);
      return [] as Event[];
    }
  }, []);

  // Fetch event data — with optional eventId
  const fetchEvent = useCallback(async (id?: string) => {
    try {
      const url = id ? `/api/judge/event?eventId=${id}` : '/api/judge/event';
      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        return { event: data.event as Event | null, isAssigned: true };
      } else if (response.status === 403) {
        if (data.errorType === 'NOT_ASSIGNED') {
          return { event: null as Event | null, isAssigned: false };
        }
      }
      return { event: null as Event | null, isAssigned: true };
    } catch (error) {
      console.error('Error fetching event:', error);
      return { event: null as Event | null, isAssigned: true };
    }
  }, []);

  // Fetch teams data
  const fetchTeams = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/judge/teams?eventId=${id}`);
      if (response.ok) {
        const data = await response.json();
        return { teams: (data.teams || []) as Team[] };
      }
      return { teams: [] as Team[] };
    } catch (error) {
      console.error('Error fetching teams:', error);
      return { teams: [] as Team[] };
    }
  }, []);

  // Fetch score completion
  const fetchScoreCompletion = useCallback(async (id?: string) => {
    try {
      const url = id ? `/api/judge/completion?eventId=${id}` : '/api/judge/completion';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return (data.completion || []) as ScoreCompletion[];
      }
      return [] as ScoreCompletion[];
    } catch (error) {
      console.error('Error fetching completion:', error);
      return [] as ScoreCompletion[];
    }
  }, []);

  // Main fetch function — behavior depends on whether eventId is provided
  const fetchAllData = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading' }));

    // Dashboard mode: no eventId, fetch available events
    if (!eventId) {
      const events = await fetchAvailableEvents();

      if (events.length === 0) {
        // Could be no events or not assigned — check via the event API (no eventId)
        const eventResult = await fetchEvent();
        // If the fetch returns not-assigned or no event, show appropriate state
        setState((prev) => ({
          ...prev,
          status: !eventResult.isAssigned ? 'not-assigned' : 'no-event',
          event: null,
          teams: [],
          scoreCompletion: [],
          error: null,
          isFullyComplete: false,
          availableEvents: [],
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: 'dashboard' as AssignmentStatus,
        event: null,
        teams: [],
        scoreCompletion: [],
        error: null,
        isFullyComplete: false,
        availableEvents: events,
      }));
      return;
    }

    // Event mode: fetch specific event data
    const eventResult = await fetchEvent(eventId);

    // Determine status
    let status: AssignmentStatus;
    if (!eventResult.isAssigned) {
      status = 'not-assigned';
    } else if (!eventResult.event) {
      status = 'no-event';
    } else {
      status = 'assigned';
    }

    // If assigned, fetch teams and completion in parallel
    let teamsData: Team[] = [];
    let completion: ScoreCompletion[] = [];

    if (status === 'assigned') {
      const [teamsResult, comp] = await Promise.all([
        fetchTeams(eventId),
        fetchScoreCompletion(eventId),
      ]);
      teamsData = teamsResult.teams;
      completion = comp;
    }

    const isFullyComplete =
      status === 'assigned' &&
      teamsData.length > 0 &&
      completion.length > 0 &&
      completion.every((c: ScoreCompletion) => c.completed);

    setState((prev) => ({
      ...prev,
      status,
      event: eventResult.event,
      teams: teamsData,
      scoreCompletion: completion,
      error: null,
      isFullyComplete,
      availableEvents: prev.availableEvents,
    }));
  }, [eventId, fetchAvailableEvents, fetchEvent, fetchTeams, fetchScoreCompletion]);

  // Refresh score completion (for when scores are updated)
  const refreshScoreCompletion = useCallback(async () => {
    const completion = await fetchScoreCompletion(eventId ?? undefined);

    setState((prev) => {
      if (prev.status !== 'assigned') return prev;

      const isFullyComplete =
        prev.teams.length > 0 &&
        completion.length > 0 &&
        completion.every((c: ScoreCompletion) => c.completed);

      return {
        ...prev,
        scoreCompletion: completion,
        isFullyComplete,
      };
    });
  }, [eventId, fetchScoreCompletion]);

  // Initial load — re-fetches when eventId changes (URL navigation)
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    ...state,
    refresh: fetchAllData,
    refreshScoreCompletion,
  };
}
