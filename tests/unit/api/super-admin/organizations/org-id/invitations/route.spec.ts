import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '@/app/api/super-admin/organizations/[orgId]/invitations/route';
import { authServer } from '@/lib/auth';
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
const params = mockParams({ orgId: 'org-1' });
const url = '/api/super-admin/organizations/org-1/invitations';
const get = () => GET(mockRequest(url), params);
const patch = (body: unknown) => PATCH(mockRequest(url, { method: 'PATCH', body }), params);
const del = (body: unknown) => DELETE(mockRequest(url, { method: 'DELETE', body }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
});

describe('GET /api/super-admin/organizations/[orgId]/invitations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('404 for an unknown organization', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await get(), 404, 'NOT_FOUND');
  });

  it('lists the invitations with links', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'org-1' }],
      [{ id: 'inv-1', token: 'tok-1', email: 'a@example.com' }]
    );
    const body = await expectJson<{ invitations: Array<{ inviteLink: string }> }>(await get());
    expect(body.invitations[0].inviteLink).toBe('http://localhost:3000/invite/tok-1');
  });
});

describe.each([
  ['PATCH', patch, 'update', 'Invitation revoked'],
  ['DELETE', del, 'delete', 'Invitation deleted'],
] as const)(
  '%s /api/super-admin/organizations/[orgId]/invitations',
  (_m, call, mutation, message) => {
    it('401 when unauthenticated', async () => {
      signOut(auth);
      await expectApiError(await call({ invitationId: 'inv-1' }), 401, 'UNAUTHORIZED');
    });

    it('400 without an invitationId', async () => {
      await expectApiError(await call({}), 400, 'BAD_REQUEST');
    });

    it('404 when the invitation is not in this organization', async () => {
      mockSelectSequence(dbMock.select, []);
      await expectApiError(await call({ invitationId: 'inv-1' }), 404, 'NOT_FOUND');
      expect(dbMock[mutation]).not.toHaveBeenCalled();
    });

    it(`${mutation}s the invitation`, async () => {
      mockSelectSequence(dbMock.select, [{ id: 'inv-1' }]);
      const change = buildAssertableMutationMock([]);
      dbMock[mutation].mockReturnValue(change.insertMock);
      expect(await expectJson(await call({ invitationId: 'inv-1' }))).toEqual({
        success: true,
        message,
      });
      if (mutation === 'update') {
        expect(change.chain.set).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'revoked' })
        );
      }
    });
  }
);
