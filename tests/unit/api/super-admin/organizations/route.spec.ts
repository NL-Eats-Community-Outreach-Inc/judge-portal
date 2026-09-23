import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/super-admin/organizations/route';
import { authServer } from '@/lib/auth';
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
const post = (body: unknown) =>
  POST(mockRequest('/api/super-admin/organizations', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
});

describe('GET /api/super-admin/organizations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin (roles do not overlap)', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('lists organizations with admin and event counts', async () => {
    mockSelectSequence(
      dbMock.select,
      [
        { id: 'org-1', name: 'NL Eats' },
        { id: 'org-2', name: 'Other' },
      ],
      [{ organizationId: 'org-1', count: 2 }],
      [{ organizationId: 'org-2', count: 5 }]
    );
    const body = await expectJson<{ organizations: Array<Record<string, unknown>> }>(await GET());
    expect(body.organizations).toEqual([
      { id: 'org-1', name: 'NL Eats', adminCount: 2, eventCount: 0 },
      { id: 'org-2', name: 'Other', adminCount: 0, eventCount: 5 },
    ]);
  });
});

describe('POST /api/super-admin/organizations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ name: 'X', slug: 'x' }), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post({ name: 'X', slug: 'x' }), 403, 'FORBIDDEN');
  });

  it('400 without a name or a slug', async () => {
    await expectApiError(await post({ slug: 'x' }), 400, 'BAD_REQUEST');
    await expectApiError(await post({ name: 'X', slug: ' ' }), 400, 'BAD_REQUEST');
  });

  it('409 when the slug is taken', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }]);
    await expectApiError(await post({ name: 'X', slug: 'nl-eats' }), 409, 'CONFLICT');
  });

  it('creates the organization with a normalised slug', async () => {
    mockSelectSequence(dbMock.select, []);
    const insert = buildAssertableMutationMock([{ id: 'org-9', name: 'QA Org', slug: 'qa-org' }]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ name: ' QA Org ', slug: 'QA Org!' }), 201);

    expect(body).toEqual({
      organization: { id: 'org-9', name: 'QA Org', slug: 'qa-org', adminCount: 0, eventCount: 0 },
    });
    expect(insert.chain.values).toHaveBeenCalledWith({
      name: 'QA Org',
      slug: 'qa-org-',
      description: null,
      logoUrl: null,
    });
  });
});
