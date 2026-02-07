'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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

export type AssignmentStatus = 'loading' | 'assigned' | 'not-assigned' | 'no-event' | 'select-event';

interface JudgeAssignmentState {
  status: AssignmentStatus;
  event: Event | null;
  teams: Team[];
  scoreCompletion: ScoreCompletion[];
  error: string | null;
  isFullyComplete: boolean;
  availableEvents: Event[];
  selectedEventId: string | null;
}

export function useJudgeAssignment() {
  const [state, setState] = useState<JudgeAssignmentState>({
    status: 'loading',
    event: null,
    teams: [],
    scoreCompletion: [],
    error: null,
    isFullyComplete: false,
    availableEvents: [],
    selectedEventId: null,
  });

  // Use ref for selectedEventId to avoid dependency chain issues
  const selectedEventIdRef = useRef<string | null>(null);

  // Build eventId query param — reads from ref, so no state deps
  const buildEventParam = useCallback((eventId?: string | null) => {
    const id = eventId ?? selectedEventIdRef.current;
    return id ? `eventId=${id}` : '';
  }, []);

  // Fetch event data
  const fetchEvent = useCallback(
    async (eventId?: string | null) => {
      try {
        const param = buildEventParam(eventId);
        const url = param ? `/api/judge/event?${param}` : '/api/judge/event';
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
          return { event: data.event as Event | null, isAssigned: true, selectEvent: false, events: [] as Event[] };
        } else if (response.status === 403) {
          if (data.errorType === 'NOT_ASSIGNED') {
            return { event: null as Event | null, isAssigned: false, selectEvent: false, events: [] as Event[] };
          }
        } else if (response.status === 300 && data.errorType === 'SELECT_EVENT') {
          return {
            event: null as Event | null,
            isAssigned: true,
            selectEvent: true,
            events: (data.events || []) as Event[],
          };
        }
        return { event: null as Event | null, isAssigned: true, selectEvent: false, events: [] as Event[] };
      } catch (error) {
        console.error('Error fetching event:', error);
        return { event: null as Event | null, isAssigned: true, selectEvent: false, events: [] as Event[] };
      }
    },
    [buildEventParam]
  );

  // Fetch teams data
  const fetchTeams = useCallback(
    async (eventId?: string | null) => {
      try {
        const param = buildEventParam(eventId);
        const url = param ? `/api/judge/teams?${param}` : '/api/judge/teams';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          return { teams: (data.teams || []) as Team[] };
        }
        return { teams: [] as Team[] };
      } catch (error) {
        console.error('Error fetching teams:', error);
        return { teams: [] as Team[] };
      }
    },
    [buildEventParam]
  );

  // Fetch score completion
  const fetchScoreCompletion = useCallback(
    async (eventId?: string | null) => {
      try {
        const param = buildEventParam(eventId);
        const url = param ? `/api/judge/completion?${param}` : '/api/judge/completion';
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
    },
    [buildEventParam]
  );

  // Main fetch function that determines assignment status
  const fetchAllData = useCallback(
    async (eventId?: string | null) => {
      setState((prev) => ({ ...prev, status: 'loading' }));

      const eventResult = await fetchEvent(eventId);

      // Handle select-event case early
      if (eventResult.selectEvent) {
        setState((prev) => ({
          ...prev,
          status: 'select-event' as AssignmentStatus,
          event: null,
          teams: [],
          scoreCompletion: [],
          error: null,
          isFullyComplete: false,
          availableEvents: eventResult.events,
        }));
        return;
      }

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
        const resolvedId = eventId ?? selectedEventIdRef.current;
        const [teamsResult, comp] = await Promise.all([
          fetchTeams(resolvedId),
          fetchScoreCompletion(resolvedId),
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
        availableEvents: eventResult.events.length > 0 ? eventResult.events : prev.availableEvents,
      }));
    },
    [fetchEvent, fetchTeams, fetchScoreCompletion]
  );

  // Select an event (used by event picker)
  const selectEvent = useCallback(
    (eventId: string) => {
      selectedEventIdRef.current = eventId;
      setState((prev) => ({ ...prev, selectedEventId: eventId }));
      fetchAllData(eventId);
    },
    [fetchAllData]
  );

  // Switch back to event picker
  const clearEventSelection = useCallback(() => {
    selectedEventIdRef.current = null;
    setState((prev) => ({
      ...prev,
      selectedEventId: null,
      status: 'select-event' as AssignmentStatus,
      event: null,
      teams: [],
      scoreCompletion: [],
      isFullyComplete: false,
    }));
  }, []);

  // Refresh score completion (for when scores are updated)
  const refreshScoreCompletion = useCallback(async () => {
    const completion = await fetchScoreCompletion();

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
  }, [fetchScoreCompletion]);

  // Initial load — only runs once since fetchAllData is now stable
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    ...state,
    refresh: fetchAllData,
    refreshScoreCompletion,
    selectEvent,
    clearEventSelection,
  };
}
