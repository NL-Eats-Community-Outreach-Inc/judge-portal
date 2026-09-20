import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '@/app/api/admin/users/[userId]/role/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
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

const put = (body: unknown, userId = 'u1') =>
  PUT(
    mockRequest(`/api/admin/users/${userId}/role`, { method: 'PUT', body }),
    mockParams({ userId })
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('PUT /api/admin/users/[userId]/role', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put({ role: 'judge' }), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await put({ role: 'judge' }), 403, 'FORBIDDEN');
  });

  it('400 for an unknown role (super_admin included)', async () => {
    await expectApiError(await put({ role: 'super_admin' }), 400, 'BAD_REQUEST');
    await expectApiError(await put({}), 400, 'BAD_REQUEST');
  });

  it('400 when an admin demotes themselves', async () => {
    await expectApiError(await put({ role: 'judge' }, 'admin-1'), 400, 'BAD_REQUEST');
  });

  it('404 when the user does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await put({ role: 'judge' }), 404, 'NOT_FOUND');
  });

  it('403 when the target is a super admin', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u-sa', role: 'super_admin', organizationId: null }]);
    await expectApiError(await put({ role: 'judge' }, 'u-sa'), 403, 'FORBIDDEN');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('403 when the target is an admin of another organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'admin', organizationId: 'org-2' }]);
    await expectApiError(await put({ role: 'judge' }), 403, 'FORBIDDEN');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('403 when the target judge is not a member of the organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'judge' }], [{ organizationId: 'org-2' }]);
    await expectApiError(await put({ role: 'participant' }), 403, 'FORBIDDEN');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('403 when the target participant is in none of the organization’s events', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'participant' }], [], []);
    await expectApiError(await put({ role: 'judge' }), 403, 'FORBIDDEN');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('promotes a participant to judge and adds the organization membership', async () => {
    // target, then the registration lookup finds them in one of the organization's events
    mockSelectSequence(
      dbMock.select,
      [{ id: 'u1', role: 'participant' }],
      [{ participantId: 'u1' }]
    );
    const insert = buildAssertableMutationMock([]);
    const update = buildAssertableMutationMock([{ id: 'u1', role: 'judge' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ role: 'judge' }));

    expect(body).toEqual({ user: { id: 'u1', role: 'judge' } });
    expect(insert.chain.values).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'u1' });
    expect(update.chain.set).toHaveBeenCalledWith({ role: 'judge' });
  });

  it('demotes a judge to participant, dropping the membership', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'judge' }], [{ organizationId: 'org-1' }]);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    const update = buildAssertableMutationMock([{ id: 'u1', role: 'participant' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    await expectJson(await put({ role: 'participant' }));

    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(update.chain.set).toHaveBeenCalledWith({ role: 'participant' });
  });

  it('promotes to admin with the admin’s organization and clears it on demotion', async () => {
    // no registration, but a team membership in one of the organization's events
    mockSelectSequence(
      dbMock.select,
      [{ id: 'u1', role: 'participant' }],
      [],
      [{ participantId: 'u1' }]
    );
    const promote = buildAssertableMutationMock([{ id: 'u1', role: 'admin' }]);
    dbMock.update.mockReturnValue(promote.insertMock);
    await expectJson(await put({ role: 'admin' }));
    expect(promote.chain.set).toHaveBeenCalledWith({ role: 'admin', organizationId: 'org-1' });

    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'admin', organizationId: 'org-1' }]);
    const demote = buildAssertableMutationMock([{ id: 'u1', role: 'participant' }]);
    dbMock.update.mockReturnValue(demote.insertMock);
    await expectJson(await put({ role: 'participant' }));
    expect(demote.chain.set).toHaveBeenCalledWith({ role: 'participant', organizationId: null });
  });
});
