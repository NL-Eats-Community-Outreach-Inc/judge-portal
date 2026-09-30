import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/participant/teams/create/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateJoinCode } from '@/lib/utils/join-code';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
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
vi.mock('@/lib/utils/join-code', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils/join-code')>()),
  generateJoinCode: vi.fn(async () => 'ABC234'),
}));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;

const valid = { eventId: 'event-1', name: 'QA-Team-A' };
const openEvent = { id: 'event-1', status: 'open', maxTeamSize: 3 };
const post = (body: unknown) =>
  POST(mockRequest('/api/participant/teams/create', { method: 'POST', body }));

/** event, registration, then inside the lock: existing membership and max order */
function reads(existingMembership: unknown[] = [], maxOrder: number | null = 2) {
  mockSelectSequence(dbMock.select, [openEvent], [{ id: 'reg-1' }], existingMembership, [
    { maxOrder },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('participant'));
});

describe('POST /api/participant/teams/create', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(valid), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post(valid), 403, 'FORBIDDEN');
  });

  it('400 without an eventId or a name', async () => {
    await expectApiError(await post({ name: 'X' }), 400, 'BAD_REQUEST');
    await expectApiError(await post({ eventId: 'event-1', name: ' ' }), 400, 'BAD_REQUEST');
  });

  it('404 when the event does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await post(valid), 404, 'NOT_FOUND');
  });

  it.each(['setup', 'active', 'completed'])(
    '400 EVENT_NOT_OPEN when the event is %s',
    async (status) => {
      mockSelectSequence(dbMock.select, [{ ...openEvent, status }]);
      await expectApiError(await post(valid), 400, 'EVENT_NOT_OPEN');
      expect(dbMock.transaction).not.toHaveBeenCalled();
    }
  );

  it('400 NOT_REGISTERED when the participant has not registered', async () => {
    mockSelectSequence(dbMock.select, [openEvent], []);
    await expectApiError(await post(valid), 400, 'NOT_REGISTERED');
  });

  it('400 ALREADY_ON_TEAM when the participant already has a team in the event', async () => {
    reads([{ id: 'm-1' }]);
    await expectApiError(await post(valid), 400, 'ALREADY_ON_TEAM');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('creates the team and the creator membership under the per-event advisory lock', async () => {
    reads([], 2);
    const teamInsert = buildAssertableMutationMock([
      { id: 't1', name: 'QA-Team-A', joinCode: 'ABC234' },
    ]);
    const memberInsert = buildAssertableMutationMock([
      { id: 'm-1', teamId: 't1', isCreator: true },
    ]);
    dbMock.insert
      .mockReturnValueOnce(teamInsert.insertMock)
      .mockReturnValueOnce(memberInsert.insertMock);

    const body = await expectJson(await post({ ...valid, description: ' d ' }), 201);

    expect(body).toEqual({
      team: { id: 't1', name: 'QA-Team-A', joinCode: 'ABC234' },
      membership: { id: 'm-1', teamId: 't1', isCreator: true },
    });
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    // the lock is taken on the event alone, never on the participant
    const lockCall = (dbMock.execute.mock.calls as unknown[][])[0];
    const lock = JSON.stringify((lockCall[0] as { queryChunks: unknown[] }).queryChunks);
    expect(lock).toContain('pg_advisory_xact_lock(hashtext(');
    expect(lock).not.toContain('||');
    expect(generateJoinCode).toHaveBeenCalled();
    expect(teamInsert.chain.values).toHaveBeenCalledWith({
      eventId: 'event-1',
      name: 'QA-Team-A',
      description: 'd',
      awardType: 'both',
      presentationOrder: 3,
      joinCode: 'ABC234',
    });
    expect(memberInsert.chain.values).toHaveBeenCalledWith({
      teamId: 't1',
      participantId: 'participant-1',
      isCreator: true,
    });
  });

  it('starts the presentation order at 1 for the first team', async () => {
    reads([], null);
    const teamInsert = buildAssertableMutationMock([{ id: 't1' }]);
    dbMock.insert
      .mockReturnValueOnce(teamInsert.insertMock)
      .mockReturnValueOnce(buildAssertableMutationMock([{ id: 'm-1' }]).insertMock);

    await expectJson(await post(valid), 201);

    expect(teamInsert.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ presentationOrder: 1 })
    );
  });

  it('400 DUPLICATE_TEAM_NAME with the user-facing message on the name violation', async () => {
    for (const constraint of ['teams_event_id_name_key', 'teams_event_id_name_unique']) {
      reads();
      dbMock.insert.mockReturnValueOnce(buildFailingMutationMock(uniqueViolation(constraint)));
      const body = await expectApiError(await post(valid), 400, 'DUPLICATE_TEAM_NAME');
      expect(body.error).toBe('A team with this name already exists in this event');
    }
  });

  it('409 CONFLICT on a presentation-order collision', async () => {
    reads();
    dbMock.insert.mockReturnValueOnce(
      buildFailingMutationMock(uniqueViolation('teams_event_id_presentation_order_unique'))
    );
    await expectApiError(await post(valid), 409, 'CONFLICT');
  });

  it('409 "Please try again" on a join-code collision (V2), never a 500', async () => {
    for (const constraint of ['teams_join_code_unique', 'teams_join_code_key']) {
      reads();
      dbMock.insert.mockReturnValueOnce(buildFailingMutationMock(uniqueViolation(constraint)));
      const body = await expectApiError(await post(valid), 409, 'CONFLICT');
      expect(body.error).toBe('Please try again');
    }
  });
});
