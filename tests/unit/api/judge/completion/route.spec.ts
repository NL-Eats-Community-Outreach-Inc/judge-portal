import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/judge/completion/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
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

const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/judge/completion${query}`));

/** The runbook teams: 2 technical and 2 business criteria in the event. */
const teams = [
  { id: 'alpha', awardType: 'technical' },
  { id: 'beta', awardType: 'business' },
  { id: 'gamma', awardType: 'both' },
  { id: 'delta', awardType: 'both' },
];
const criteriaCounts = [
  { category: 'technical', count: 2 },
  { category: 'business', count: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/completion', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('returns an empty list when the judge has no active assignment', async () => {
    mockSelectSequence(dbMock.select, []);
    expect(await expectJson(await get())).toEqual({ completion: [] });
  });

  it('403 NOT_ASSIGNED for an event the judge is not assigned to', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-2' }]);
    await expectApiError(await get(), 403, 'NOT_ASSIGNED');
  });

  it('400 SELECT_EVENT with several assignments and no eventId', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }, { id: 'event-2' }]);
    await expectApiError(await get(''), 400, 'SELECT_EVENT');
  });

  it('marks teams complete, partial or untouched from applicable rows only (runbook judge 2)', async () => {
    // judge 2 in S0: Alpha 2 of 2, Beta 2 of 2, Gamma 2 of 4, Delta 0
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], teams, criteriaCounts, [
      { teamId: 'alpha', count: 2 },
      { teamId: 'beta', count: 2 },
      { teamId: 'gamma', count: 2 },
    ]);

    expect(await expectJson(await get())).toEqual({
      completion: [
        { teamId: 'alpha', completed: true, partial: false },
        { teamId: 'beta', completed: true, partial: false },
        { teamId: 'gamma', completed: false, partial: true },
        { teamId: 'delta', completed: false, partial: false },
      ],
    });
  });

  it('never reports a team as complete when it has no applicable criteria', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'event-1' }],
      [{ id: 'beta', awardType: 'business' }],
      [{ category: 'technical', count: 2 }],
      []
    );
    expect(await expectJson(await get(''))).toEqual({
      completion: [{ teamId: 'beta', completed: false, partial: false }],
    });
  });
});
