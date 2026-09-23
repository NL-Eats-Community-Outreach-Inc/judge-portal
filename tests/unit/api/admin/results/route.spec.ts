import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/results/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { loadCountedScores, loadEventCriteria } from '@/lib/db/results';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
  signOut,
  scopeToOrg,
  expectApiError,
  expectJson,
  type AuthServerMock,
  type OrgMock,
} from '@/tests/unit/test-utils/route-harness';
import { CRITERIA, SCORES, TEAMS } from '@/tests/unit/test-utils/results-fixture';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});
vi.mock('@/lib/auth/org', async () => {
  const { buildOrgMock } = await import('@/tests/unit/test-utils/route-harness');
  return buildOrgMock();
});
vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});
vi.mock('@/lib/db/results', () => ({
  loadCountedScores: vi.fn(),
  loadEventCriteria: vi.fn(),
}));

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;

const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/admin/results${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  vi.mocked(loadCountedScores).mockResolvedValue(SCORES);
  vi.mocked(loadEventCriteria).mockResolvedValue(CRITERIA);
});

describe('GET /api/admin/results', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await get(), 404, 'NOT_FOUND');
    expect(loadCountedScores).not.toHaveBeenCalled();
  });

  it('400 without an eventId', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
  });

  it('404 when the event does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('returns the event, the counted scores and the computed rankings', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', name: 'QA-Preflight' }]);

    const body = await expectJson<{
      event: { id: string };
      criteriaCount: number;
      allCriteria: unknown[];
      scores: unknown[];
      teamTotals: Array<{ teamId: string; totalScore: number; weightedScore: number }>;
      criteriaAverages: Array<{ teamId: string; criterionId: string; averageScore: number }>;
    }>(await get());

    expect(body.event.id).toBe('event-1');
    expect(body.criteriaCount).toBe(4);
    expect(body.allCriteria).toHaveLength(4);
    expect(body.scores).toHaveLength(SCORES.length);
    expect(body.teamTotals.map((t) => [t.teamId, t.totalScore, t.weightedScore])).toEqual([
      [TEAMS.gamma.id, 40, 5.7],
      [TEAMS.beta.id, 31, 7.38],
      [TEAMS.alpha.id, 30, 7.5],
    ]);
    expect(body.criteriaAverages[0]).toMatchObject({
      teamId: TEAMS.alpha.id,
      criterionId: 'C1',
      averageScore: 7.5,
    });
    expect(loadCountedScores).toHaveBeenCalledWith('event-1');
  });
});
