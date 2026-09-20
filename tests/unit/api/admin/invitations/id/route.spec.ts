import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '@/app/api/admin/invitations/[id]/route';
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

vi.mock('@/lib/auth', async (importOriginal) => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return {
    ...(await importOriginal<typeof import('@/lib/auth')>()),
    authServer: buildAuthServerMock(),
  };
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
const params = mockParams({ id: 'inv-1' });

const patch = () => PATCH(mockRequest('/api/admin/invitations/inv-1', { method: 'PATCH' }), params);
const del = () => DELETE(mockRequest('/api/admin/invitations/inv-1', { method: 'DELETE' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe.each([
  ['PATCH', patch, 'update'],
  ['DELETE', del, 'delete'],
] as const)('%s /api/admin/invitations/[id]', (_method, call, mutation) => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await call(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await call(), 403, 'FORBIDDEN');
  });

  it('404 when the invitation does not exist', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await call(), 404, 'NOT_FOUND');
  });

  it('404 when the invitation belongs to another organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'inv-1', organizationId: 'org-2' }]);
    await expectApiError(await call(), 404, 'NOT_FOUND');
    expect(dbMock[mutation]).not.toHaveBeenCalled();
  });

  it(`${mutation}s the organization’s invitation`, async () => {
    mockSelectSequence(dbMock.select, [{ id: 'inv-1', organizationId: 'org-1' }]);
    const change = buildAssertableMutationMock([]);
    dbMock[mutation].mockReturnValue(change.insertMock);

    const body = await expectJson(await call());

    expect(body).toMatchObject({ success: true });
    expect(dbMock[mutation]).toHaveBeenCalledTimes(1);
    if (mutation === 'update') {
      expect(change.chain.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'revoked' }));
    }
  });
});
