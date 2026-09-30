import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/admin/event/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { OrphanedAdminError } from '@/lib/auth/org';
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

const auth = authServer as unknown as AuthServerMock;
const orgMock = org as unknown as OrgMock;
const dbMock = db as unknown as DbMock;

const post = (body: unknown) => POST(mockRequest('/api/admin/event', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('GET /api/admin/event', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for a super admin (roles do not overlap)', async () => {
    signInAs(auth, fakeUser('super_admin'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('403 NO_ORGANIZATION for an admin without an organization', async () => {
    orgMock.getAdminOrgId.mockRejectedValue(new OrphanedAdminError());
    await expectApiError(await GET(), 403, 'NO_ORGANIZATION');
  });

  it('returns the organization’s events and name', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'e1', name: 'Event' }], [{ name: 'NL Eats' }]);
    const body = await expectJson(await GET());
    expect(body).toEqual({ events: [{ id: 'e1', name: 'Event' }], organizationName: 'NL Eats' });
  });
});

describe('POST /api/admin/event', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ name: 'X' }), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await post({ name: 'X' }), 403, 'FORBIDDEN');
  });

  it('400 without a name', async () => {
    await expectApiError(await post({ name: '' }), 400, 'BAD_REQUEST');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('400 INVALID_STATUS when the body asks for any status but setup', async () => {
    await expectApiError(await post({ name: 'QA-Live', status: 'active' }), 400, 'INVALID_STATUS');
    await expectApiError(await post({ name: 'QA-Live', status: 'bogus' }), 400, 'INVALID_STATUS');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('400 when maxTeamSize is not a positive integer', async () => {
    await expectApiError(await post({ name: 'QA-Live', maxTeamSize: 'abc' }), 400, 'BAD_REQUEST');
    await expectApiError(await post({ name: 'QA-Live', maxTeamSize: 0 }), 400, 'BAD_REQUEST');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('creates the event in the admin’s organization with status setup', async () => {
    const insert = buildAssertableMutationMock([
      { id: 'e1', name: 'QA-Preflight', status: 'setup' },
    ]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ name: ' QA-Preflight ', maxTeamSize: 3 }), 201);

    expect(body).toEqual({ event: { id: 'e1', name: 'QA-Preflight', status: 'setup' } });
    expect(insert.chain.values).toHaveBeenCalledWith({
      name: 'QA-Preflight',
      description: null,
      status: 'setup',
      organizationId: 'org-1',
      maxTeamSize: 3,
    });
  });

  it('500 with the envelope when the database fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    dbMock.insert.mockImplementation(() => {
      throw new Error('connection reset');
    });
    await expectApiError(await post({ name: 'X' }), 500, 'INTERNAL_SERVER_ERROR');
    expect(spy).toHaveBeenCalledWith('Error creating event:', expect.any(Error));
    spy.mockRestore();
  });
});
