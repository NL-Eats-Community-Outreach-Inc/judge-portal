import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/invitations/route';
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

const post = (body: unknown) =>
  POST(mockRequest('/api/admin/invitations', { method: 'POST', body }));
const get = () => GET(mockRequest('/api/admin/invitations'));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('POST /api/admin/invitations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ emails: ['a@example.com'] }), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post({ emails: ['a@example.com'] }), 403, 'FORBIDDEN');
  });

  it.each([
    ['an unknown role', { emails: ['a@example.com'], role: 'super_admin' }],
    ['no emails', { emails: [] }],
    ['a malformed email', { emails: ['not-an-email'] }],
  ])('400 for %s', async (_label, body) => {
    await expectApiError(await post(body), 400, 'BAD_REQUEST');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('creates judge invitations in the admin’s organization with links', async () => {
    // pending-invitation lookup, then existing-user lookup, for the one email
    mockSelectSequence(dbMock.select, [], []);
    const insert = buildAssertableMutationMock([
      { id: 'inv-1', email: 'new@example.com', role: 'judge', status: 'pending', token: 'tok-1' },
    ]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{ invitations: Array<{ inviteLink: string }> }>(
      await post({ emails: ['new@example.com'], role: 'judge', expiresInDays: 3 }),
      201
    );

    expect(body.invitations[0].inviteLink).toBe('http://localhost:3000/invite/tok-1');
    expect(insert.chain.values).toHaveBeenCalledWith([
      expect.objectContaining({
        email: 'new@example.com',
        role: 'judge',
        organizationId: 'org-1',
        createdBy: 'admin-1',
      }),
    ]);
  });

  it('adds an existing judge of another organization directly instead of inviting', async () => {
    mockSelectSequence(
      dbMock.select,
      [],
      [{ id: 'j9', email: 'judge@example.com', role: 'judge' }],
      []
    );
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ emails: ['judge@example.com'], role: 'judge' }));

    expect(body).toMatchObject({
      success: true,
      invitations: [],
      autoAdded: [{ email: 'judge@example.com' }],
    });
    expect(insert.chain.values).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'j9' });
  });

  it('reports emails that are already invited or registered without creating anything', async () => {
    // pending-invitation lookups for both emails, then the user lookups for both
    mockSelectSequence(
      dbMock.select,
      [{ id: 'inv-0', email: 'pending@example.com' }],
      [],
      [],
      [{ id: 'u1', email: 'admin2@example.com', role: 'admin' }]
    );

    const body = await expectJson(
      await post({ emails: ['pending@example.com', 'admin2@example.com'] })
    );

    expect(body).toMatchObject({
      message: 'All emails are already invited or registered',
      existingInvites: ['pending@example.com'],
      alreadyRegistered: [{ email: 'admin2@example.com', role: 'admin' }],
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/invitations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('lists the organization’s invitations with links', async () => {
    mockSelectSequence(dbMock.select, [
      { id: 'inv-1', email: 'a@example.com', role: 'judge', status: 'pending', token: 'tok-1' },
    ]);
    const body = await expectJson<{ invitations: Array<{ inviteLink: string }> }>(await get());
    expect(body.invitations[0].inviteLink).toBe('http://localhost:3000/invite/tok-1');
  });
});
