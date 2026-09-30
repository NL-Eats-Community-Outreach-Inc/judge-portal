import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/judge/scores/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
  signOut,
  expectApiError,
  expectJson,
  type AuthServerMock,
} from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});
vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;

const technicalTeam = { id: 't1', awardType: 'technical' };
const technicalCriterion = { minScore: 1, maxScore: 10, category: 'technical' };
const businessCriterion = { minScore: 1, maxScore: 10, category: 'business' };
const valid = { eventId: 'event-1', teamId: 't1', criterionId: 'c1', score: 8 };

const get = (query = '?teamId=t1&eventId=event-1') => GET(mockRequest(`/api/judge/scores${query}`));
const post = (body: unknown) => POST(mockRequest('/api/judge/scores', { method: 'POST', body }));

/** assigned events, team, criterion — the reads POST does before writing */
function scoringReads(
  team: unknown[] = [technicalTeam],
  criterion: unknown[] = [technicalCriterion],
  assigned: unknown[] = [{ id: 'event-1' }]
) {
  mockSelectSequence(dbMock.select, assigned, team, criterion);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/scores', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('400 without a teamId', async () => {
    await expectApiError(await get('?eventId=event-1'), 400, 'BAD_REQUEST');
  });

  it('400 NO_ACTIVE_EVENT when the judge has no active assignment', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await get(), 400, 'NO_ACTIVE_EVENT');
  });

  it('403 NOT_ASSIGNED for an event the judge is not assigned to', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-2' }]);
    await expectApiError(await get(), 403, 'NOT_ASSIGNED');
  });

  it('400 SELECT_EVENT with several assignments and no eventId', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }, { id: 'event-2' }]);
    await expectApiError(await get('?teamId=t1'), 400, 'SELECT_EVENT');
  });

  it('returns the judge’s own scores for the team', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'event-1' }],
      [{ id: 's1', criterionId: 'c1', score: 8, comment: null }]
    );
    expect(await expectJson(await get())).toEqual({
      scores: [{ id: 's1', criterionId: 'c1', score: 8, comment: null }],
    });
  });
});

describe('POST /api/judge/scores', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(valid), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await post(valid), 403, 'FORBIDDEN');
  });

  it('400 for a body that is not JSON', async () => {
    const response = await POST(
      mockRequest('/api/judge/scores', { method: 'POST', body: '{not json' })
    );
    await expectApiError(response, 400, 'BAD_REQUEST');
  });

  it('400 without teamId or criterionId', async () => {
    await expectApiError(await post({ ...valid, teamId: undefined }), 400, 'BAD_REQUEST');
  });

  it.each([5.5, null, undefined, '8', NaN])('400 INVALID_SCORE for score %s', async (score) => {
    const body = await expectApiError(await post({ ...valid, score }), 400, 'INVALID_SCORE');
    expect(body.error).toBe('Score must be a whole number');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('400 NO_ACTIVE_EVENT and 403 NOT_ASSIGNED from the event resolution', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await post(valid), 400, 'NO_ACTIVE_EVENT');
    mockSelectSequence(dbMock.select, [{ id: 'event-2' }]);
    await expectApiError(await post(valid), 403, 'NOT_ASSIGNED');
  });

  it('400 when the team or the criterion is not in the active event', async () => {
    scoringReads([]);
    await expectApiError(await post(valid), 400, 'BAD_REQUEST');
    scoringReads([technicalTeam], []);
    await expectApiError(await post(valid), 400, 'BAD_REQUEST');
  });

  it('400 CRITERION_NOT_APPLICABLE for a business criterion on a technical team', async () => {
    scoringReads([technicalTeam], [businessCriterion]);
    await expectApiError(await post(valid), 400, 'CRITERION_NOT_APPLICABLE');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('accepts every criterion for a General (both) team', async () => {
    scoringReads([{ id: 't1', awardType: 'both' }], [businessCriterion]);
    const insert = buildAssertableMutationMock([{ id: 's1', score: 8 }]);
    dbMock.insert.mockReturnValue(insert.insertMock);
    await expectJson(await post(valid));
  });

  it('400 INVALID_SCORE outside the criterion’s range', async () => {
    scoringReads();
    const body = await expectApiError(await post({ ...valid, score: 11 }), 400, 'INVALID_SCORE');
    expect(body.error).toBe('Score must be between 1 and 10');
  });

  it('upserts the score on (judge, team, criterion) and returns it', async () => {
    scoringReads();
    const insert = buildAssertableMutationMock([{ id: 's1', score: 8, comment: 'Solid' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ ...valid, comment: 'Solid' }));

    expect(body).toEqual({ success: true, score: { id: 's1', score: 8, comment: 'Solid' } });
    expect(insert.chain.values).toHaveBeenCalledWith({
      eventId: 'event-1',
      judgeId: 'judge-1',
      teamId: 't1',
      criterionId: 'c1',
      score: 8,
      comment: 'Solid',
    });
    expect(insert.chain.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: expect.objectContaining({ score: 8, comment: 'Solid' }) })
    );
  });

  it('resolves the single active event when the body has no eventId', async () => {
    scoringReads();
    const insert = buildAssertableMutationMock([{ id: 's1' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    await expectJson(await post({ ...valid, eventId: undefined }));

    expect(insert.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'event-1' })
    );
  });
});
