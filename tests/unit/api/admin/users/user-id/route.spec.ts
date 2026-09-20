import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '@/app/api/admin/users/[userId]/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
import {
  buildAssertableMutationMock,
  buildSelectMock,
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
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;
const deleteUser = vi.fn();

const del = (userId = 'u1') =>
  DELETE(mockRequest(`/api/admin/users/${userId}`, { method: 'DELETE' }), mockParams({ userId }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  deleteUser.mockResolvedValue({ error: null });
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { admin: { deleteUser } },
  } as unknown as ReturnType<typeof createAdminClient>);
  dbMock.delete.mockImplementation(() => buildAssertableMutationMock([]).insertMock);
});

describe('DELETE /api/admin/users/[userId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('404 when the user does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it('403 for a super admin target', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'super_admin' }]);
    await expectApiError(await del(), 403, 'FORBIDDEN');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('403 for an admin of another organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'admin', organizationId: 'org-2' }]);
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('403 for a judge who is not a member of the organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'judge' }], [{ organizationId: 'org-2' }]);
    await expectApiError(await del(), 403, 'FORBIDDEN');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('removes a judge from the organization without deleting the account', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'u1', role: 'judge' }],
      [{ organizationId: 'org-1' }],
      [{ id: 'event-1' }]
    );

    const body = await expectJson(await del());

    expect(body).toMatchObject({ success: true, action: 'removed_from_org' });
    // membership row, then unscored event_judges rows; never the users row
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('403 for a participant with no team in the organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'participant' }]);
    dbMock.selectDistinct.mockReturnValueOnce(buildSelectMock([]));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('deletes a participant from the database and then from auth', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'participant' }]);
    dbMock.selectDistinct.mockReturnValueOnce(buildSelectMock([{ participantId: 'u1' }]));

    const body = await expectJson(await del());

    expect(body).toEqual({ success: true });
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });

  it('deletes an admin of the same organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'admin', organizationId: 'org-1' }]);
    await expectJson(await del());
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });
});
