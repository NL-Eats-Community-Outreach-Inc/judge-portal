import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/participant/teams/join/route';
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

const team = { id: 't1', name: 'QA-Team-A', eventId: 'event-1', joinCode: 'ABC234' };
const openEvent = { id: 'event-1', status: 'open', maxTeamSize: 3 };
const post = (body: unknown) =>
  POST(mockRequest('/api/participant/teams/join', { method: 'POST', body }));

/** team, event, registration, then in the lock: existing membership and (if limited) the member count */
function reads(options: { event?: unknown; existing?: unknown[]; memberCount?: number } = {}) {
  const event = options.event ?? openEvent;
  const sequence: unknown[][] = [[team], [event], [{ id: 'reg-1' }], options.existing ?? []];
  if ((event as { maxTeamSize: number | null }).maxTeamSize) {
    sequence.push([{ memberCount: options.memberCount ?? 1 }]);
  }
  mockSelectSequence(dbMock.select, ...sequence);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
});

describe('POST /api/participant/teams/join', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ joinCode: 'ABC234' }), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await post({ joinCode: 'ABC234' }), 403, 'FORBIDDEN');
  });

  it('400 without a code or with a malformed one', async () => {
    await expectApiError(await post({}), 400, 'BAD_REQUEST');
    await expectApiError(await post({ joinCode: 'AB01' }), 400, 'BAD_REQUEST');
    await expectApiError(await post({ joinCode: 'ABCIO1' }), 400, 'BAD_REQUEST');
  });

  it('404 for an unknown code', async () => {
    mockSelectSequence(dbMock.select, []);
    const body = await expectApiError(await post({ joinCode: 'abc234' }), 404, 'NOT_FOUND');
    expect(body.error).toBe('Invalid join code');
  });

  it('400 EVENT_NOT_OPEN when the event is not open', async () => {
    mockSelectSequence(dbMock.select, [team], [{ ...openEvent, status: 'active' }]);
    await expectApiError(await post({ joinCode: 'ABC234' }), 400, 'EVENT_NOT_OPEN');
  });

  it('400 NOT_REGISTERED when the participant is not registered for the event', async () => {
    mockSelectSequence(dbMock.select, [team], [openEvent], []);
    await expectApiError(await post({ joinCode: 'ABC234' }), 400, 'NOT_REGISTERED');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('400 ALREADY_ON_TEAM when the participant already has a team in the event', async () => {
    reads({ existing: [{ id: 'm-0' }] });
    await expectApiError(await post({ joinCode: 'ABC234' }), 400, 'ALREADY_ON_TEAM');
  });

  it('400 TEAM_FULL when the team is at the event’s maximum size', async () => {
    reads({ memberCount: 3 });
    const body = await expectApiError(await post({ joinCode: 'ABC234' }), 400, 'TEAM_FULL');
    expect(body.error).toBe('This team is full');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('adds the participant as a member (code normalised) and returns the team', async () => {
    reads({ memberCount: 1 });
    const insert = buildAssertableMutationMock([{ id: 'm-1', teamId: 't1', isCreator: false }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ joinCode: ' abc234 ' }), 201);

    expect(body).toEqual({ team, membership: { id: 'm-1', teamId: 't1', isCreator: false } });
    expect(insert.chain.values).toHaveBeenCalledWith({
      teamId: 't1',
      participantId: 'participant-1',
      isCreator: false,
    });
    // the advisory lock, then the row lock on the team
    expect(dbMock.execute).toHaveBeenCalledTimes(2);
  });

  it('skips the size check when the event has no maximum', async () => {
    reads({ event: { ...openEvent, maxTeamSize: null } });
    dbMock.insert.mockReturnValue(buildAssertableMutationMock([{ id: 'm-1' }]).insertMock);

    await expectJson(await post({ joinCode: 'ABC234' }), 201);

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
  });
});
