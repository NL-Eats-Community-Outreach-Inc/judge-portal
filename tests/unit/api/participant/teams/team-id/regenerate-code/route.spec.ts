import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/participant/teams/[teamId]/regenerate-code/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireTeamCreator, requireTeamEventOpen } from '@/lib/auth/participant';
import { generateJoinCode } from '@/lib/utils/join-code';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
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
vi.mock('@/lib/auth/participant', () => ({
  requireTeamCreator: vi.fn(),
  requireTeamEventOpen: vi.fn(),
}));
vi.mock('@/lib/utils/join-code', () => ({ generateJoinCode: vi.fn(async () => 'XYZ789') }));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const post = () =>
  POST(
    mockRequest('/api/participant/teams/t1/regenerate-code', { method: 'POST' }),
    mockParams({ teamId: 't1' })
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
  vi.mocked(requireTeamCreator).mockResolvedValue({
    id: 'm-1',
    isCreator: true,
    teamId: 't1',
    participantId: 'participant-1',
    joinedAt: 'x',
  });
  vi.mocked(requireTeamEventOpen).mockResolvedValue({
    teamId: 't1',
    eventId: 'event-1',
    eventStatus: 'open',
    eventName: 'QA',
    maxTeamSize: null,
  });
});

describe('POST /api/participant/teams/[teamId]/regenerate-code', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post(), 403, 'FORBIDDEN');
  });

  it.each([
    ['NOT_MEMBER', 403, 'NOT_MEMBER'],
    ['NOT_CREATOR', 403, 'NOT_CREATOR'],
    ['TEAM_NOT_FOUND', 404, 'TEAM_NOT_FOUND'],
  ] as const)(
    'maps %s from the creator check to the participant code',
    async (code, status, apiCode) => {
      vi.mocked(requireTeamCreator).mockRejectedValue(new Error(code));
      await expectApiError(await post(), status, apiCode);
      expect(dbMock.update).not.toHaveBeenCalled();
    }
  );

  it('400 EVENT_NOT_OPEN once the event is no longer open', async () => {
    vi.mocked(requireTeamEventOpen).mockRejectedValue(new Error('EVENT_NOT_OPEN'));
    await expectApiError(await post(), 400, 'EVENT_NOT_OPEN');
  });

  it('stores and returns a fresh code', async () => {
    const update = buildAssertableMutationMock([{ id: 't1', joinCode: 'XYZ789' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    expect(await expectJson(await post())).toEqual({ joinCode: 'XYZ789' });
    expect(generateJoinCode).toHaveBeenCalled();
    expect(update.chain.set).toHaveBeenCalledWith({ joinCode: 'XYZ789' });
  });
});
