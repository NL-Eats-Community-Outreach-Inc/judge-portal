import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from '@/app/api/super-admin/users/[userId]/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';
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
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const deleteUser = vi.fn();
const del = (userId = 'u1') =>
  DELETE(
    mockRequest(`/api/super-admin/users/${userId}`, { method: 'DELETE' }),
    mockParams({ userId })
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
  deleteUser.mockResolvedValue({ error: null });
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { admin: { deleteUser } },
  } as unknown as ReturnType<typeof createAdminClient>);
});

describe('DELETE /api/super-admin/users/[userId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('400 for the caller’s own account', async () => {
    await expectApiError(await del('super_admin-1'), 400, 'BAD_REQUEST');
  });

  it('404 for an unknown user', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it('403 for another super admin', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', email: 'x@example.com', role: 'super_admin' }]);
    await expectApiError(await del(), 403, 'FORBIDDEN');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('400 INVALID_STATUS for a judge who has scores, without deleting anything', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'u1', email: 'x@example.com', role: 'judge' }],
      [{ id: 'score-1' }]
    );
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    const body = await expectApiError(await del(), 400, 'INVALID_STATUS');
    expect(body.error).toBe('This judge has scores; remove them from the organization instead');
    expect(dbMock.delete).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('500 when the database delete fails, without touching auth', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSelectSequence(dbMock.select, [{ id: 'u1', email: 'x@example.com', role: 'judge' }], []);
    dbMock.delete.mockReturnValue(buildFailingMutationMock(new Error('fk')));
    await expectApiError(await del(), 500, 'INTERNAL_SERVER_ERROR');
    expect(deleteUser).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('deletes the profile row and then the auth user', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', email: 'x@example.com', role: 'judge' }], []);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);

    expect(await expectJson(await del())).toEqual({
      success: true,
      message: 'User "x@example.com" deleted',
    });
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });
});
