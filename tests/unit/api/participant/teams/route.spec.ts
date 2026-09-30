import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/participant/teams/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
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

const row = {
  id: 't1',
  name: 'QA-Team-A',
  description: null,
  demoUrl: null,
  repoUrl: null,
  eventId: 'event-1',
  joinCode: 'ABC234',
  presentationOrder: 1,
  awardType: 'both',
  eventName: 'QA-Preflight',
  eventStatus: 'open',
  maxTeamSize: 3,
  isCreator: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
});

describe('GET /api/participant/teams', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('lists the participant’s teams with member counts', async () => {
    mockSelectSequence(dbMock.select, [row], [{ teamId: 't1', memberCount: '2' }]);
    const body = await expectJson<{ teams: Array<Record<string, unknown>> }>(await GET());
    expect(body.teams).toEqual([{ ...row, memberCount: 2 }]);
  });

  it('skips the count query when there are no teams', async () => {
    mockSelectSequence(dbMock.select, []);
    expect(await expectJson(await GET())).toEqual({ teams: [] });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });
});
