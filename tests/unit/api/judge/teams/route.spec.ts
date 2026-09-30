import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/judge/teams/route';
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

const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/judge/teams${query}`));
const teams = [
  { id: 't1', name: 'QA-Alpha', description: null, presentationOrder: 1 },
  { id: 't2', name: 'QA-Beta', description: null, presentationOrder: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/teams', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a super admin', async () => {
    signInAs(auth, fakeUser('super_admin'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('returns no teams without an active assignment', async () => {
    mockSelectSequence(dbMock.select, []);
    expect(await expectJson(await get())).toEqual({ teams: [] });
  });

  it('403 NOT_ASSIGNED for an event outside the assignments', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-2' }]);
    await expectApiError(await get(), 403, 'NOT_ASSIGNED');
  });

  it('400 SELECT_EVENT with several events and no selection', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }, { id: 'event-2' }]);
    await expectApiError(await get(''), 400, 'SELECT_EVENT');
  });

  it('lists the event’s teams in presentation order', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], teams);
    expect(await expectJson(await get())).toEqual({ teams });
  });
});
