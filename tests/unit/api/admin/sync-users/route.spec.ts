import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/sync-users/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/server';
import { OrphanedAdminError } from '@/lib/auth/org';
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
vi.mock('@/lib/auth/org', async (importOriginal) => {
  const { buildOrgMock } = await import('@/tests/unit/test-utils/route-harness');
  return { ...(await importOriginal<typeof import('@/lib/auth/org')>()), ...buildOrgMock() };
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
const listUsers = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { admin: { listUsers } },
  } as unknown as ReturnType<typeof createAdminClient>);
});

describe('POST /api/admin/sync-users', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await POST(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await POST(), 403, 'FORBIDDEN');
  });

  it('403 NO_ORGANIZATION for an orphaned admin', async () => {
    orgMock.getAdminOrgId.mockRejectedValue(new OrphanedAdminError());
    await expectApiError(await POST(), 403, 'NO_ORGANIZATION');
  });

  it('500 AUTH_LIST_FAILED when the auth listing fails', async () => {
    listUsers.mockResolvedValue({ data: { users: [] }, error: new Error('nope') });
    await expectApiError(await POST(), 500, 'AUTH_LIST_FAILED');
  });

  it('creates the missing profile rows as judges in the organization and reports the rest', async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'a1', email: 'exists@example.com' },
          { id: 'a2', email: 'missing@example.com' },
          { id: 'a3', email: null },
        ],
      },
      error: null,
    });
    // existing profiles, then the invitation lookup for the missing emails
    mockSelectSequence(dbMock.select, [{ id: 'a1', role: 'admin', organizationId: 'org-1' }], []);
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{ results: Array<Record<string, unknown>> }>(await POST());

    expect(body.results).toEqual([
      {
        id: 'a1',
        email: 'exists@example.com',
        action: 'exists',
        role: 'admin',
        organizationId: 'org-1',
      },
      {
        id: 'a2',
        email: 'missing@example.com',
        action: 'created',
        role: 'judge',
        organizationId: 'org-1',
      },
    ]);
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
    expect(insert.chain.values).toHaveBeenNthCalledWith(1, {
      id: 'a2',
      email: 'missing@example.com',
      role: 'judge',
      organizationId: null,
    });
    expect(insert.chain.values).toHaveBeenNthCalledWith(2, {
      organizationId: 'org-1',
      userId: 'a2',
    });
  });

  it('takes the role from the sign-up metadata when it is a real role', async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [{ id: 'a2', email: 'entrant@example.com', user_metadata: { role: 'participant' } }],
      },
      error: null,
    });
    // no existing profile, no invitation for the email
    mockSelectSequence(dbMock.select, [], []);
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{ results: Array<Record<string, unknown>> }>(await POST());

    expect(body.results[0]).toMatchObject({ action: 'created', role: 'participant' });
    expect(insert.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a2', role: 'participant' })
    );
  });

  it('makes a synced judge a member of the admin’s organization', async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ id: 'a2', email: 'missing@example.com', user_metadata: {} }] },
      error: null,
    });
    mockSelectSequence(dbMock.select, [], []);
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{ results: Array<Record<string, unknown>> }>(await POST());

    expect(body.results[0]).toMatchObject({
      action: 'created',
      role: 'judge',
      organizationId: 'org-1',
    });
    expect(insert.chain.values).toHaveBeenCalledWith({ organizationId: 'org-1', userId: 'a2' });
  });

  it('takes the role from an invitation for the email and gives an admin the organization', async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [{ id: 'a2', email: 'Invited@Example.com', user_metadata: { role: 'judge' } }],
      },
      error: null,
    });
    mockSelectSequence(
      dbMock.select,
      [],
      [{ email: 'invited@example.com', role: 'admin', status: 'pending' }]
    );
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{ results: Array<Record<string, unknown>> }>(await POST());

    expect(body.results[0]).toMatchObject({
      action: 'created',
      role: 'admin',
      organizationId: 'org-1',
    });
    expect(insert.chain.values).toHaveBeenCalledWith({
      id: 'a2',
      email: 'Invited@Example.com',
      role: 'admin',
      organizationId: 'org-1',
    });
  });

  it('never creates a super admin from metadata', async () => {
    listUsers.mockResolvedValue({
      data: {
        users: [{ id: 'a2', email: 'x@example.com', user_metadata: { role: 'super_admin' } }],
      },
      error: null,
    });
    mockSelectSequence(dbMock.select, [], []);
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson<{ results: Array<Record<string, unknown>> }>(await POST());

    expect(body.results[0]).toMatchObject({ action: 'created', role: 'judge' });
  });

  it('reports a row that could not be created without failing the call', async () => {
    listUsers.mockResolvedValue({
      data: { users: [{ id: 'a2', email: 'missing@example.com' }] },
      error: null,
    });
    mockSelectSequence(dbMock.select, [], []);
    dbMock.insert.mockReturnValue(buildFailingMutationMock(new Error('boom')));

    const body = await expectJson<{ results: Array<Record<string, unknown>> }>(await POST());

    expect(body.results[0]).toMatchObject({ action: 'error', error: 'boom' });
  });

  it('answers an empty list without querying the database', async () => {
    listUsers.mockResolvedValue({ data: { users: [] }, error: null });
    expect(await expectJson(await POST())).toEqual({ results: [] });
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});
