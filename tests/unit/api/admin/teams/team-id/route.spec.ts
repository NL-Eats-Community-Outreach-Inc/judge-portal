import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/admin/teams/[teamId]/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
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

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;
const params = mockParams({ teamId: 't1' });

const valid = { name: 'QA-Alpha', presentationOrder: 1, awardType: 'technical' };
const put = (body: unknown) =>
  PUT(mockRequest('/api/admin/teams/t1', { method: 'PUT', body }), params);
const del = () => DELETE(mockRequest('/api/admin/teams/t1', { method: 'DELETE' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('PUT /api/admin/teams/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put(valid), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await put(valid), 403, 'FORBIDDEN');
  });

  it('404 when the team’s event belongs to another organization', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await put(valid), 404, 'NOT_FOUND');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('404 when the team does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await put(valid), 404, 'NOT_FOUND');
  });

  it('400 without a name or a numeric presentation order', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    await expectApiError(await put({ ...valid, name: '' }), 400, 'BAD_REQUEST');
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    await expectApiError(await put({ ...valid, presentationOrder: '1' }), 400, 'BAD_REQUEST');
    for (const presentationOrder of [0, 1.5, -2]) {
      mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
      await expectApiError(await put({ ...valid, presentationOrder }), 400, 'BAD_REQUEST');
    }
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('400 INVALID_STATUS when the event is completed', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'completed' }]);
    dbMock.update.mockReturnValue(buildAssertableMutationMock([{ id: 't1' }]).insertMock);
    const body = await expectApiError(await put(valid), 400, 'INVALID_STATUS');
    expect(body.error).toBe('The event is completed');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('still updates the team while the event is active (rename and award type by design)', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'active' }]);
    dbMock.update.mockReturnValue(buildAssertableMutationMock([{ id: 't1' }]).insertMock);
    await expectJson(await put(valid));
    expect(dbMock.update).toHaveBeenCalledTimes(1);
  });

  it('updates the team', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    const update = buildAssertableMutationMock([{ id: 't1', name: 'QA-Alpha' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ ...valid, demoUrl: ' https://d ' }));

    expect(body).toEqual({ team: { id: 't1', name: 'QA-Alpha' } });
    expect(update.chain.set).toHaveBeenCalledWith({
      name: 'QA-Alpha',
      description: null,
      demoUrl: 'https://d',
      repoUrl: null,
      awardType: 'technical',
      presentationOrder: 1,
    });
  });

  it('400 DUPLICATE_TEAM_NAME and DUPLICATE_PRESENTATION_ORDER on the unique violations', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    dbMock.update.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('teams_event_id_name_key'))
    );
    await expectApiError(await put(valid), 400, 'DUPLICATE_TEAM_NAME');

    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    dbMock.update.mockReturnValue(
      buildFailingMutationMock(uniqueViolation('teams_event_id_presentation_order_unique'))
    );
    await expectApiError(await put(valid), 400, 'DUPLICATE_PRESENTATION_ORDER');
  });
});

describe('DELETE /api/admin/teams/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('404 when the team’s event belongs to another organization', async () => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus: 'open' }]);
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await del(), 404, 'NOT_FOUND');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('404 when the team does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it.each(['active', 'completed'])(
    '400 INVALID_STATUS when the event is %s, leaving the team and its scores alone',
    async (eventStatus) => {
      mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus }]);
      dbMock.delete.mockReturnValue(buildAssertableMutationMock([{ id: 't1' }]).insertMock);
      const body = await expectApiError(await del(), 400, 'INVALID_STATUS');
      expect(body.error).toBe('Teams can only be deleted while the event is in setup or open');
      expect(dbMock.delete).not.toHaveBeenCalled();
    }
  );

  it.each(['setup', 'open'])('deletes the team while the event is %s', async (eventStatus) => {
    mockSelectSequence(dbMock.select, [{ eventId: 'event-1', eventStatus }]);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([{ id: 't1' }]).insertMock);
    expect(await expectJson(await del())).toEqual({ success: true });
  });
});
