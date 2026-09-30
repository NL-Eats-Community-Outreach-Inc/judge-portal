import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '@/app/api/participant/teams/[teamId]/members/[userId]/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireTeamCreator, requireTeamEventOpen } from '@/lib/auth/participant';
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

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const remove = (userId = 'participant-2') =>
  DELETE(
    mockRequest(`/api/participant/teams/t1/members/${userId}`, { method: 'DELETE' }),
    mockParams({ teamId: 't1', userId })
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

describe('DELETE /api/participant/teams/[teamId]/members/[userId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await remove(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await remove(), 403, 'FORBIDDEN');
  });

  it.each([
    ['NOT_MEMBER', 403, 'NOT_MEMBER'],
    ['NOT_CREATOR', 403, 'NOT_CREATOR'],
    ['TEAM_NOT_FOUND', 404, 'TEAM_NOT_FOUND'],
  ] as const)(
    'maps %s from the creator check to the participant code',
    async (code, status, apiCode) => {
      vi.mocked(requireTeamCreator).mockRejectedValue(new Error(code));
      await expectApiError(await remove(), status, apiCode);
      expect(dbMock.delete).not.toHaveBeenCalled();
    }
  );

  it('400 EVENT_NOT_OPEN once the event is no longer open', async () => {
    vi.mocked(requireTeamEventOpen).mockRejectedValue(new Error('EVENT_NOT_OPEN'));
    await expectApiError(await remove(), 400, 'EVENT_NOT_OPEN');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('400 when the creator names themselves', async () => {
    const response = await remove(fakeUser('participant').id);
    await expectApiError(response, 400, 'BAD_REQUEST');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('404 when the target is not a member of the team', async () => {
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    await expectApiError(await remove('stranger'), 404, 'NOT_FOUND');
  });

  it('deletes the membership row and answers success', async () => {
    const del = buildAssertableMutationMock([{ id: 'm-2' }]);
    dbMock.delete.mockReturnValue(del.insertMock);

    expect(await expectJson(await remove())).toEqual({ success: true });
    expect(requireTeamCreator).toHaveBeenCalledWith('t1', fakeUser('participant').id);
    expect(requireTeamEventOpen).toHaveBeenCalledWith('t1');
    expect(del.chain.where).toHaveBeenCalledTimes(1);
    expect(del.chain.returning).toHaveBeenCalledTimes(1);
  });
});
