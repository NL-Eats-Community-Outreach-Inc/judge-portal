import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/participant/teams/[teamId]/leave/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
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
const params = mockParams({ teamId: 't1' });

const teamEvent = { teamId: 't1', eventId: 'event-1', eventStatus: 'open' };
const me = { id: 'm-1', participantId: 'participant-1', isCreator: true, joinedAt: '2026-01-01' };
const other = { id: 'm-2', participantId: 'p-2', isCreator: false, joinedAt: '2026-01-02' };
const post = () => POST(mockRequest('/api/participant/teams/t1/leave', { method: 'POST' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
  dbMock.delete.mockImplementation(() => buildAssertableMutationMock([]).insertMock);
});

describe('POST /api/participant/teams/[teamId]/leave', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post(), 403, 'FORBIDDEN');
  });

  it('404 when the team does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await post(), 404, 'NOT_FOUND');
  });

  it('400 EVENT_NOT_OPEN when the event is not open', async () => {
    mockSelectSequence(dbMock.select, [{ ...teamEvent, eventStatus: 'active' }]);
    await expectApiError(await post(), 400, 'EVENT_NOT_OPEN');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('403 NOT_MEMBER when the participant is not on the team', async () => {
    mockSelectSequence(dbMock.select, [teamEvent], [other]);
    await expectApiError(await post(), 403, 'NOT_MEMBER');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('deletes the team when the last member leaves', async () => {
    mockSelectSequence(dbMock.select, [teamEvent], [me]);
    const body = await expectJson(await post());
    expect(body).toEqual({ success: true, teamDeleted: true });
    // the membership row, then the team
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('transfers the creator flag to the earliest remaining member', async () => {
    mockSelectSequence(dbMock.select, [teamEvent], [me, other]);
    const update = buildAssertableMutationMock([]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await post());

    expect(body).toEqual({ success: true, teamDeleted: false });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(update.chain.set).toHaveBeenCalledWith({ isCreator: true });
  });

  it('leaves the creator alone when a plain member leaves', async () => {
    signInAs(auth, fakeUser('participant', { id: 'p-2' }));
    mockSelectSequence(dbMock.select, [teamEvent], [me, other]);

    const body = await expectJson(await post());

    expect(body).toEqual({ success: true, teamDeleted: false });
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
