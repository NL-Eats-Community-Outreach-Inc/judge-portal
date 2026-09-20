import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/super-admin/organizations/[orgId]/admins/route';
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
const org = { id: 'org-1', name: 'NL Eats' };
const get = () => GET(mockRequest('/api/super-admin/organizations/org-1/admins'), params);
const post = (body: unknown) =>
  POST(
    mockRequest('/api/super-admin/organizations/org-1/admins', { method: 'POST', body }),
    params
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
});

describe('GET /api/super-admin/organizations/[orgId]/admins', () => {
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

  it('lists the organization’s admins', async () => {
    const admins = [{ id: 'a1', email: 'admin@example.com', role: 'admin', createdAt: 'x' }];
    mockSelectSequence(dbMock.select, [org], admins);
    expect(await expectJson(await get())).toEqual({ admins });
  });
});

describe('POST /api/super-admin/organizations/[orgId]/admins', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ emails: ['a@example.com'] }), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post({ emails: ['a@example.com'] }), 403, 'FORBIDDEN');
  });

  it('404 for an unknown organization', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await post({ emails: ['a@example.com'] }), 404, 'NOT_FOUND');
  });

  it('400 without emails or with a malformed one', async () => {
    mockSelectSequence(dbMock.select, [org]);
    await expectApiError(await post({ emails: [] }), 400, 'BAD_REQUEST');
    mockSelectSequence(dbMock.select, [org]);
    await expectApiError(await post({ emails: ['nope'] }), 400, 'BAD_REQUEST');
  });

  it('creates admin invitations for the organization with links', async () => {
    // org, pending invitation lookup, existing user lookup
    mockSelectSequence(dbMock.select, [org], [], []);
    const insert = buildAssertableMutationMock([
      { id: 'inv-1', email: 'new@example.com', role: 'admin', status: 'pending', token: 'tok-1' },
    ]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{
      invitations: Array<{ inviteLink: string }>;
      organizationName: string;
    }>(await post({ emails: ['new@example.com'] }), 201);

    expect(body.organizationName).toBe('NL Eats');
    expect(body.invitations[0].inviteLink).toBe('http://localhost:3000/invite/tok-1');
    expect(insert.chain.values).toHaveBeenCalledWith([
      expect.objectContaining({
        email: 'new@example.com',
        role: 'admin',
        organizationId: 'org-1',
        createdBy: 'super_admin-1',
      }),
    ]);
  });

  it('reports already invited or registered emails without inserting', async () => {
    mockSelectSequence(
      dbMock.select,
      [org],
      [{ id: 'inv-0' }],
      [],
      [{ email: 'user@example.com', role: 'judge' }]
    );

    const body = await expectJson(
      await post({ emails: ['pending@example.com', 'user@example.com'] })
    );

    expect(body).toMatchObject({
      existingInvites: ['pending@example.com'],
      alreadyRegistered: [{ email: 'user@example.com', role: 'judge' }],
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
