import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/super-admin/organizations/[orgId]/route';
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
const get = () => GET(mockRequest('/api/super-admin/organizations/org-1'), params);
const put = (body: unknown) =>
  PUT(mockRequest('/api/super-admin/organizations/org-1', { method: 'PUT', body }), params);
const del = () =>
  DELETE(mockRequest('/api/super-admin/organizations/org-1', { method: 'DELETE' }), params);

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
});

describe('GET /api/super-admin/organizations/[orgId]', () => {
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

  it('returns the organization with its counts', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'org-1', name: 'NL Eats' }],
      [{ count: 2 }],
      [{ count: 3 }]
    );
    expect(await expectJson(await get())).toEqual({
      organization: { id: 'org-1', name: 'NL Eats', adminCount: 2, eventCount: 3 },
    });
  });
});

describe('PUT /api/super-admin/organizations/[orgId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put({ name: 'X' }), 401, 'UNAUTHORIZED');
  });

  it('404 for an unknown organization', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await put({ name: 'X' }), 404, 'NOT_FOUND');
  });

  it('400 for an empty name, an empty slug or no fields', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }]);
    await expectApiError(await put({ name: ' ' }), 400, 'BAD_REQUEST');
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }]);
    await expectApiError(await put({ slug: '  ' }), 400, 'BAD_REQUEST');
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }]);
    await expectApiError(await put({}), 400, 'BAD_REQUEST');
  });

  it('409 when the new slug belongs to another organization', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }], [{ id: 'org-2' }]);
    await expectApiError(await put({ slug: 'taken' }), 409, 'CONFLICT');
  });

  it('updates the given fields', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }], []);
    const update = buildAssertableMutationMock([{ id: 'org-1', name: 'New', slug: 'new' }]);
    dbMock.update.mockReturnValue(update.insertMock);

    const body = await expectJson(await put({ name: ' New ', slug: 'New', description: '' }));

    expect(body).toEqual({ organization: { id: 'org-1', name: 'New', slug: 'new' } });
    expect(update.chain.set).toHaveBeenCalledWith({ name: 'New', slug: 'new', description: null });
  });
});

describe('DELETE /api/super-admin/organizations/[orgId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await del(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await del(), 403, 'FORBIDDEN');
  });

  it('404 for an unknown organization', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await del(), 404, 'NOT_FOUND');
  });

  it('400 INVALID_STATUS while one of its events is open or active', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'org-1', name: 'NL Eats' }],
      [{ id: 'e1', name: 'Live Event' }]
    );
    await expectApiError(await del(), 400, 'INVALID_STATUS');
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it('deletes the organization when none of its events is live', async () => {
    // organization, then the live-event lookup (none)
    mockSelectSequence(dbMock.select, [{ id: 'org-1', name: 'NL Eats' }], []);
    dbMock.delete.mockReturnValue(buildAssertableMutationMock([]).insertMock);
    expect(await expectJson(await del())).toEqual({
      success: true,
      message: 'Organization "NL Eats" deleted',
    });
  });
});
