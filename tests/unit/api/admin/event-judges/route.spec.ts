import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, DELETE } from '@/app/api/admin/event-judges/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
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
  scopeToOrg,
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

const get = (query = '?eventId=event-1') => GET(mockRequest(`/api/admin/event-judges${query}`));
const post = (body: unknown) =>
  POST(mockRequest('/api/admin/event-judges', { method: 'POST', body }));
const del = (query = '?eventId=event-1&judgeId=j1') =>
  DELETE(mockRequest(`/api/admin/event-judges${query}`, { method: 'DELETE' }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('GET /api/admin/event-judges', () => {
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

  it('400 without an eventId', async () => {
    await expectApiError(await get(''), 400, 'BAD_REQUEST');
  });

  it('returns the assigned judges and the organization’s judges', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ judgeId: 'j1', email: 'j1@example.com' }],
      [
        { id: 'j1', email: 'j1@example.com' },
        { id: 'j2', email: 'j2@example.com' },
      ]
    );
    const body = await expectJson<{ assigned: unknown[]; available: unknown[] }>(await get());
    expect(body.assigned).toHaveLength(1);
    expect(body.available).toHaveLength(2);
  });
});

describe('POST /api/admin/event-judges', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ eventId: 'event-1', judgeIds: [] }), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await post({ eventId: 'event-1', judgeIds: [] }), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization before anything is deleted', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await post({ eventId: 'event-1', judgeIds: ['j1'] }), 404, 'NOT_FOUND');
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('400 without an eventId or a judgeIds array', async () => {
    await expectApiError(await post({ judgeIds: [] }), 400, 'BAD_REQUEST');
    await expectApiError(await post({ eventId: 'event-1', judgeIds: 'j1' }), 400, 'BAD_REQUEST');
  });

  it('403 when a judge is not a member of the organization', async () => {
    mockSelectSequence(dbMock.select, [{ userId: 'j1' }]);
    await expectApiError(
      await post({ eventId: 'event-1', judgeIds: ['j1', 'j9'] }),
      403,
      'FORBIDDEN'
    );
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('replaces the organization’s assignments in one transaction', async () => {
    mockSelectSequence(dbMock.select, [{ userId: 'j1' }, { userId: 'j2' }]);
    const remove = buildAssertableMutationMock([]);
    const insert = buildAssertableMutationMock([]);
    dbMock.delete.mockReturnValue(remove.insertMock);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ eventId: 'event-1', judgeIds: ['j2'] }));

    expect(body).toEqual({ success: true });
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(insert.chain.values).toHaveBeenCalledWith([{ eventId: 'event-1', judgeId: 'j2' }]);
  });

  it('clears the assignments when judgeIds is empty', async () => {
    mockSelectSequence(dbMock.select, [{ userId: 'j1' }]);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);

    await expectJson(await post({ eventId: 'event-1', judgeIds: [] }));

    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/event-judges', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for a super admin', async () => {
    signInAs(auth, fakeUser('super_admin'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('404 for an event of another organization', async () => {
    scopeToOrg(orgMock, 'org-1', false);
    await expectApiError(await del(), 404, 'NOT_FOUND');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('400 without both ids', async () => {
    await expectApiError(await del('?eventId=event-1'), 400, 'BAD_REQUEST');
  });

  it('removes the one assignment', async () => {
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    expect(await expectJson(await del())).toEqual({ success: true });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});
