import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/participant/teams/[teamId]/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  requireTeamMembership,
  requireTeamCreator,
  requireTeamEventOpen,
} from '@/lib/auth/participant';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  buildFailingMutationMock,
  mockSelectSequence,
  resetDbMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
import {
  fakeUser,
  signInAs,
  signOut,
  uniqueViolation,
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
  requireTeamMembership: vi.fn(),
  requireTeamCreator: vi.fn(),
  requireTeamEventOpen: vi.fn(),
  requireEventRegistration: vi.fn(),
}));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const params = mockParams({ teamId: 't1' });

const team = {
  id: 't1',
  name: 'QA-Team-A',
  eventId: 'event-1',
  joinCode: 'ABC234',
  eventStatus: 'open',
  maxTeamSize: 3,
};
const get = () => GET(mockRequest('/api/participant/teams/t1'), params);
const put = (body: unknown) =>
  PUT(mockRequest('/api/participant/teams/t1', { method: 'PUT', body }), params);
const del = () => DELETE(mockRequest('/api/participant/teams/t1', { method: 'DELETE' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
  vi.mocked(requireTeamMembership).mockResolvedValue({
    id: 'm-1',
    isCreator: true,
    teamId: 't1',
    participantId: 'participant-1',
    joinedAt: 'x',
  });
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
    maxTeamSize: 3,
  });
});

describe('GET /api/participant/teams/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('403 NOT_MEMBER for a non-member', async () => {
    vi.mocked(requireTeamMembership).mockRejectedValue(new Error('NOT_MEMBER'));
    await expectApiError(await get(), 403, 'NOT_MEMBER');
  });

  it('404 TEAM_NOT_FOUND when the team row is gone', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await get(), 404, 'TEAM_NOT_FOUND');
  });

  it('returns the team with the join code, member count and creator flag', async () => {
    mockSelectSequence(dbMock.select, [team], [], [{ memberCount: '2' }]);
    const body = await expectJson(await get());
    expect(body).toEqual({
      team: { ...team, isCreator: true, memberCount: 2, hasSubmitted: false },
    });
  });
});

describe('PUT /api/participant/teams/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put({ name: 'X' }), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await put({ name: 'X' }), 403, 'FORBIDDEN');
  });

  it('403 NOT_MEMBER for a non-member', async () => {
    vi.mocked(requireTeamMembership).mockRejectedValue(new Error('NOT_MEMBER'));
    await expectApiError(await put({ name: 'X' }), 403, 'NOT_MEMBER');
  });

  it('400 EVENT_NOT_OPEN once the event has started', async () => {
    vi.mocked(requireTeamEventOpen).mockRejectedValue(new Error('EVENT_NOT_OPEN'));
    await expectApiError(await put({ name: 'X' }), 400, 'EVENT_NOT_OPEN');
  });

  it('400 for an empty name or no fields', async () => {
    await expectApiError(await put({ name: ' ' }), 400, 'TEAM_NAME_EMPTY');
    await expectApiError(await put({}), 400, 'NO_FIELDS_TO_UPDATE');
  });

  it('updates only the fields present in the body', async () => {
    const update = buildAssertableMutationMock([{ ...team, name: 'QA-Renamed' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ name: ' QA-Renamed ', demoUrl: '' }));

    expect(body).toEqual({ team: { ...team, name: 'QA-Renamed' } });
    expect(update.chain.set).toHaveBeenCalledWith({ name: 'QA-Renamed', demoUrl: null });
  });

  it('400 DUPLICATE_TEAM_NAME on the unique violation', async () => {
    dbMock.update.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('teams_event_id_name_unique'))
    );
    const body = await expectApiError(await put({ name: 'QA-Alpha' }), 400, 'DUPLICATE_TEAM_NAME');
    expect(body.error).toBe('A team with this name already exists in this event');
  });
});

describe('DELETE /api/participant/teams/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 NOT_CREATOR for a plain member', async () => {
    vi.mocked(requireTeamCreator).mockRejectedValue(new Error('NOT_CREATOR'));
    await expectApiError(await del(), 403, 'NOT_CREATOR');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('400 EVENT_NOT_OPEN once the event has started', async () => {
    vi.mocked(requireTeamEventOpen).mockRejectedValue(new Error('EVENT_NOT_OPEN'));
    await expectApiError(await del(), 400, 'EVENT_NOT_OPEN');
  });

  it('deletes the team for its creator', async () => {
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    expect(await expectJson(await del())).toEqual({ success: true });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});
