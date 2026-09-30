import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';

/**
 * Thin wrappers over the admin, judge and participant APIs for spec setup:
 * every spec builds its own `QA-` event through these instead of the UI so
 * the UI specs stay focused on the journey they verify.
 */
export type EventStatus = 'setup' | 'open' | 'active' | 'completed';
export type AwardType = 'technical' | 'business' | 'both';
export type Category = 'technical' | 'business';

async function json<T>(response: APIResponse, expectedStatus = 200): Promise<T> {
  const body = await response.text();
  expect(response.status(), `${response.url()} → ${body}`).toBe(expectedStatus);
  return (body ? JSON.parse(body) : {}) as T;
}

export function qaName(prefix: string): string {
  return `QA-${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createEvent(
  admin: APIRequestContext,
  name: string,
  options: { description?: string; maxTeamSize?: number | null } = {}
) {
  const { event } = await json<{ event: { id: string; name: string; status: EventStatus } }>(
    await admin.post('/api/admin/event', {
      data: {
        name,
        description: options.description ?? 'Temporary verification event. Delete after testing.',
        status: 'setup',
        maxTeamSize: options.maxTeamSize ?? null,
      },
    }),
    201
  );
  return event;
}

/** Changes the status (and, when given, the team size); every other field stays as it is. */
export async function setEventStatus(
  admin: APIRequestContext,
  eventId: string,
  status: EventStatus,
  name: string,
  maxTeamSize?: number | null
) {
  return json<{ event: { status: EventStatus } }>(
    await admin.put(`/api/admin/events/${eventId}`, {
      data: { name, status, ...(maxTeamSize !== undefined ? { maxTeamSize } : {}) },
    })
  );
}

/** Deletes a QA event, walking it back to `setup` first because only setup events can be deleted. */
export async function deleteEvent(admin: APIRequestContext, eventId: string, name: string) {
  const current = await admin.get('/api/admin/event');
  if (current.status() !== 200) return;
  const { events } = (await current.json()) as {
    events: Array<{ id: string; status: EventStatus }>;
  };
  const event = events.find((e) => e.id === eventId);
  if (!event) return;
  const path: EventStatus[] =
    event.status === 'completed'
      ? ['active', 'open', 'setup']
      : event.status === 'active'
        ? ['open', 'setup']
        : event.status === 'open'
          ? ['setup']
          : [];
  for (const status of path) await setEventStatus(admin, eventId, status, name);
  await admin.delete(`/api/admin/events/${eventId}`);
}

export async function addCriterion(
  admin: APIRequestContext,
  eventId: string,
  criterion: {
    name: string;
    category: Category;
    weight: number;
    minScore?: number;
    maxScore?: number;
  }
) {
  const { criterion: created } = await json<{ criterion: { id: string; name: string } }>(
    await admin.post('/api/admin/criteria', {
      data: { eventId, minScore: 1, maxScore: 10, ...criterion },
    }),
    201
  );
  return created;
}

export async function addTeam(
  admin: APIRequestContext,
  eventId: string,
  team: { name: string; awardType: AwardType; description?: string }
) {
  const { team: created } = await json<{
    team: { id: string; name: string; presentationOrder: number; joinCode: string };
  }>(await admin.post('/api/admin/teams', { data: { eventId, ...team } }), 201);
  return created;
}

export async function assignJudges(admin: APIRequestContext, eventId: string, judgeIds: string[]) {
  await json(await admin.post('/api/admin/event-judges', { data: { eventId, judgeIds } }));
}

export async function orgJudges(admin: APIRequestContext, eventId: string) {
  const body = await json<{ available: Array<{ id: string; email: string }> }>(
    await admin.get(`/api/admin/event-judges?eventId=${eventId}`)
  );
  return body.available;
}

export async function postScore(
  judge: APIRequestContext,
  data: { eventId: string; teamId: string; criterionId: string; score: number; comment?: string }
) {
  return judge.post('/api/judge/scores', { data });
}

export async function results(admin: APIRequestContext, eventId: string) {
  return json<{
    scores: Array<{
      team: { id: string };
      criterion: { id: string };
      judge: { id: string };
      score: number;
    }>;
    teamTotals: Array<{
      teamId: string;
      teamName: string;
      totalScore: number;
      averageScore: number;
      weightedScore: number;
      totalScores: number;
      judgeCount: number;
    }>;
    criteriaAverages: Array<{ teamId: string; criterionId: string; averageScore: number }>;
    allCriteria: Array<{ id: string; category: Category }>;
  }>(await admin.get(`/api/admin/results?eventId=${eventId}`));
}

/** Splits one CSV line into fields, honouring RFC 4180 quoting. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

export function parseCsv(text: string): string[][] {
  return text
    .trimEnd()
    .split('\n')
    .map((line) => parseCsvLine(line.replace(/\r$/, '')));
}
