import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/super-admin/users/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockSelectSequence, resetDbMock, type DbMock } from '@/tests/unit/test-utils/mock-db';
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

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('super_admin'));
});

describe('GET /api/super-admin/users', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('lists every user with their organization memberships', async () => {
    mockSelectSequence(
      dbMock.select,
      [
        {
          id: 'j1',
          email: 'j@example.com',
          role: 'judge',
          organizationId: null,
          organizationName: null,
        },
        {
          id: 'a1',
          email: 'a@example.com',
          role: 'admin',
          organizationId: 'org-1',
          organizationName: 'NL Eats',
        },
      ],
      [{ userId: 'j1', orgId: 'org-1', orgName: 'NL Eats' }]
    );

    const body = await expectJson<{ users: Array<Record<string, unknown>> }>(await GET());

    expect(body.users[0].organizationMemberships).toEqual([{ id: 'org-1', name: 'NL Eats' }]);
    expect(body.users[1].organizationMemberships).toEqual([]);
  });
});
