'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch, ApiError, messageOf } from '@/lib/api/client';
import type { JudgeEvent as Event, JudgeTeam as Team, ScoreCompletion } from '@/lib/types';

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
  const router = useRouter();
  const [state, setState] = useState<JudgeAssignmentState>({
    status: 'loading',
    event: null,
    teams: [],
    scoreCompletion: [],
    error: null,
    isFullyComplete: false,
    availableEvents: [],
  });

  // An expired session must not look like an empty event: say so and go to login
  const reportFetchError = useCallback(
    (context: string, error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        toast.error(messageOf(error, 'Your session has expired. Sign in again.'), {
          id: 'session-expired',
        });
        router.replace('/auth/login');
        return;
      }
      console.error(`${context}:`, error);
    },
    [router]
  );

  // Fetch available events for dashboard mode
  const fetchAvailableEvents = useCallback(async () => {
    try {
      const data = await apiFetch<{ events?: Event[] }>('/api/judge/events');
      return data.events || [];
    } catch (error) {
      reportFetchError('Error fetching available events', error);
      return [] as Event[];
    }
  }, [reportFetchError]);

  // Fetch event data — with optional eventId
  const fetchEvent = useCallback(
    async (id?: string) => {
      try {
        const url = id ? `/api/judge/event?eventId=${id}` : '/api/judge/event';
        const data = await apiFetch<{ event: Event | null }>(url);
        return { event: data.event, isAssigned: true };
      } catch (error) {
        // NOT_ASSIGNED: no assignment; SELECT_EVENT: several active ones and no
        // eventId given (dashboard mode). Neither is an error worth logging.
        if (error instanceof ApiError && error.code === 'NOT_ASSIGNED') {
          return { event: null as Event | null, isAssigned: false };
        }
        if (error instanceof ApiError && error.code === 'SELECT_EVENT') {
          return { event: null as Event | null, isAssigned: true };
        }
        reportFetchError('Error fetching event', error);
        return { event: null as Event | null, isAssigned: true };
      }
    },
    [reportFetchError]
  );

  // Fetch teams data
  const fetchTeams = useCallback(
    async (id: string) => {
      try {
        const data = await apiFetch<{ teams?: Team[] }>(`/api/judge/teams?eventId=${id}`);
        return { teams: data.teams || [] };
      } catch (error) {
        reportFetchError('Error fetching teams', error);
        return { teams: [] as Team[] };
      }
    },
    [reportFetchError]
  );

  // Fetch score completion
  const fetchScoreCompletion = useCallback(
    async (id?: string) => {
      try {
        const url = id ? `/api/judge/completion?eventId=${id}` : '/api/judge/completion';
        const data = await apiFetch<{ completion?: ScoreCompletion[] }>(url);
        return data.completion || [];
      } catch (error) {
        reportFetchError('Error fetching completion', error);
        return [] as ScoreCompletion[];
      }
    },
    [reportFetchError]
  );

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
