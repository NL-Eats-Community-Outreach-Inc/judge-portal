import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '@/app/api/super-admin/users/[userId]/role/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
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
const put = (body: unknown, userId = 'u1') =>
  PUT(
    mockRequest(`/api/super-admin/users/${userId}/role`, { method: 'PUT', body }),
    mockParams({ userId })
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
  dbMock.delete.mockImplementation(() => buildAssertableMutationMock([]).insertMock);
});

describe('PUT /api/super-admin/users/[userId]/role', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put({ role: 'judge' }), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await put({ role: 'judge' }), 403, 'FORBIDDEN');
  });

  it('400 for an unknown role or the caller’s own account', async () => {
    await expectApiError(await put({ role: 'super_admin' }), 400, 'BAD_REQUEST');
    await expectApiError(await put({ role: 'judge' }, 'super_admin-1'), 400, 'BAD_REQUEST');
  });

  it('404 for an unknown user', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await put({ role: 'judge' }), 404, 'NOT_FOUND');
  });

  it('403 when the target is a super admin', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'super_admin' }]);
    await expectApiError(await put({ role: 'judge' }), 403, 'FORBIDDEN');
  });

  it('400 when promoting to admin without an organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'judge' }]);
    await expectApiError(await put({ role: 'admin' }), 400, 'BAD_REQUEST');
  });

  it('updates in place when the role does not change', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'admin' }]);
    const update = buildAssertableMutationMock([
      { id: 'u1', role: 'admin', organizationId: 'org-2' },
    ]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ role: 'admin', organizationId: 'org-2' }));

    expect(body).toEqual({ user: { id: 'u1', role: 'admin', organizationId: 'org-2' } });
    expect(dbMock.transaction).not.toHaveBeenCalled();
    expect(update.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin', organizationId: 'org-2' })
    );
  });

  it('cleans up a judge’s memberships and unscored assignments before the change', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'u1', role: 'judge' }]);
    const update = buildAssertableMutationMock([{ id: 'u1', role: 'participant' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ role: 'participant' }));

    expect(body).toEqual({ user: { id: 'u1', role: 'participant' } });
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
    expect(update.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'participant', organizationId: null })
    );
  });

  it('transfers a participant’s creator flag, removes the memberships and empty unscored teams', async () => {
    // target, memberships, next member, remaining members, team scores
    mockSelectSequence(
      dbMock.select,
      [{ id: 'u1', role: 'participant' }],
      [{ teamId: 't1', isCreator: true }],
      [{ id: 'm-2', participantId: 'p-2' }],
      [],
      []
    );
    const updates: ReturnType<typeof buildAssertableMutationMock>[] = [];
    dbMock.update.mockImplementation(() => {
      const u = buildAssertableMutationMock([{ id: 'u1', role: 'judge' }]);
      updates.push(u);
      return u.insertMock;
    });

    await expectJson(await put({ role: 'judge' }));

    // creator transfer, then the role update
    expect(updates[0].chain.set).toHaveBeenCalledWith({ isCreator: true });
    expect(updates[1].chain.set).toHaveBeenCalledWith(expect.objectContaining({ role: 'judge' }));
    // membership, empty team, event registrations
    expect(dbMock.delete).toHaveBeenCalledTimes(3);
  });

  it('keeps an empty team that already has scores', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'u1', role: 'participant' }],
      [{ teamId: 't1', isCreator: false }],
      [],
      [{ id: 's1' }]
    );
    dbMock.update.mockReturnValue(
      buildAssertableMutationMock([{ id: 'u1', role: 'judge' }]).insertMock
    );
    dbMock.select.mockReturnValue(buildSelectMock([]));

    await expectJson(await put({ role: 'judge' }));

    // membership and event registrations only
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
  });
});
