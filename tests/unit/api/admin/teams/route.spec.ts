import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/teams/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
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
  scopeToOrg,
  uniqueViolation,
  expectApiError,
  expectJson,
  type AuthServerMock,
  type OrgMock,
} from '@/tests/unit/test-utils/route-harness';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});
vi.mock('@/lib/auth/org', async () => {
  const { buildOrgMock } = await import('@/tests/unit/test-utils/route-harness');
  return buildOrgMock();
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
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;

const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/admin/teams${query}`));
const post = (body: unknown) => POST(mockRequest('/api/admin/teams', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('GET /api/admin/teams', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('lists teams with their members grouped in and the join code selected', async () => {
    mockSelectSequence(
      dbMock.select,
      [
        { id: 't1', name: 'QA-Alpha', eventId: 'event-1', joinCode: 'ABC234' },
        { id: 't2', name: 'QA-Beta', eventId: 'event-1', joinCode: 'XYZ789' },
      ],
      [{ teamId: 't1', participantId: 'p1', email: 'a@example.com', isCreator: true }]
    );

    const body = await expectJson<{
      teams: Array<{ id: string; joinCode: string; members: unknown[] }>;
    }>(await get());

    expect(body.teams.map((t) => [t.id, t.joinCode, t.members.length])).toEqual([
      ['t1', 'ABC234', 1],
      ['t2', 'XYZ789', 0],
    ]);
    // the column is part of the team select, not only passed through by the mock
    expect(dbMock.select.mock.calls[0][0]).toHaveProperty('joinCode');
  });

  it('skips the member query when there are no teams', async () => {
    mockSelectSequence(dbMock.select, []);
    expect(await expectJson(await get())).toEqual({ teams: [] });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/admin/teams', () => {
  const valid = { eventId: 'event-1', name: 'QA-Alpha', awardType: 'technical' };

  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post(valid), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await post(valid), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await post(valid), 404, 'NOT_FOUND');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('400 without an eventId or a name', async () => {
    await expectApiError(await post({ name: 'X' }), 400, 'BAD_REQUEST');
    await expectApiError(await post({ eventId: 'event-1', name: ' ' }), 400, 'BAD_REQUEST');
  });

  it('400 when the event row is missing', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await post(valid), 400, 'BAD_REQUEST');
  });

  it('400 INVALID_STATUS when the event is completed', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'completed' }], [{ maxOrder: 1 }]);
    dbMock.insert.mockReturnValue(buildAssertableMutationMock([{ id: 't1' }]).insertMock);
    const body = await expectApiError(await post(valid), 400, 'INVALID_STATUS');
    expect(body.error).toBe('The event is completed');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('creates the team with the next presentation order and a join code under the event lock', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], [{ maxOrder: 3 }]);
    const insert = buildAssertableMutationMock([
      { id: 't1', name: 'QA-Alpha', joinCode: 'ABC234' },
    ]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ ...valid, description: ' d ' }), 201);

    expect(body).toEqual({ team: { id: 't1', name: 'QA-Alpha', joinCode: 'ABC234', members: [] } });
    // two admins adding teams at once are serialised on the event, so the
    // max-order read and the insert happen inside one transaction
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    const lockCall = (dbMock.execute.mock.calls as unknown[][])[0];
    const lock = JSON.stringify((lockCall[0] as { queryChunks: unknown[] }).queryChunks);
    expect(lock).toContain('pg_advisory_xact_lock(hashtext(');
    expect(dbMock.transaction.mock.invocationCallOrder[0]).toBeLessThan(
      dbMock.insert.mock.invocationCallOrder[0]
    );
    expect(generateJoinCode).toHaveBeenCalled();
    expect(insert.chain.values).toHaveBeenCalledWith({
      eventId: 'event-1',
      name: 'QA-Alpha',
      description: 'd',
      demoUrl: null,
      repoUrl: null,
      awardType: 'technical',
      presentationOrder: 4,
      joinCode: 'ABC234',
    });
  });

  it('defaults the award type to both and the order to 1 for the first team', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], [{ maxOrder: null }]);
    const insert = buildAssertableMutationMock([{ id: 't1' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    await expectJson(await post({ eventId: 'event-1', name: 'QA-Delta' }), 201);

    expect(insert.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ awardType: 'both', presentationOrder: 1 })
    );
  });

  it('400 DUPLICATE_TEAM_NAME with the user-facing message (both constraint names)', async () => {
    for (const constraint of ['teams_event_id_name_key', 'teams_event_id_name_unique']) {
      mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], [{ maxOrder: 1 }]);
      dbMock.insert.mockReturnValue(buildFailingMutationMock(uniqueViolation(constraint)));
      const body = await expectApiError(await post(valid), 400, 'DUPLICATE_TEAM_NAME');
      expect(body.error).toBe('A team with this name already exists in this event');
    }
  });

  it('409 on a presentation-order collision', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1', status: 'open' }], [{ maxOrder: 1 }]);
    dbMock.insert.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('teams_event_id_presentation_order_unique'))
    );
    await expectApiError(await post(valid), 409, 'CONFLICT');
  });
});
