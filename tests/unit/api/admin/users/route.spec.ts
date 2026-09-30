import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/admin/users/route';
import { authServer } from '@/lib/auth';
import * as org from '@/lib/auth/org';
import { db } from '@/lib/db';
import { OrphanedAdminError } from '@/lib/auth/org';
import {
  buildSelectMock,
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

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('admin'));
  scopeToOrg(orgMock);
});

describe('GET /api/admin/users', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for a judge', async () => {
    signInAs(auth, fakeUser('judge'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('403 NO_ORGANIZATION for an orphaned admin', async () => {
    orgMock.getAdminOrgId.mockRejectedValue(new OrphanedAdminError());
    await expectApiError(await GET(), 403, 'NO_ORGANIZATION');
  });

  it('merges the organization’s admins, member judges and event participants', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'a1', role: 'admin' }], // admins
      [{ userId: 'j1' }], // member ids
      [{ id: 'j1', role: 'judge' }], // judges
      [{ id: 'p1', role: 'participant' }] // participants (after the two distinct lookups)
    );
    dbMock.selectDistinct
      .mockReturnValueOnce(buildSelectMock([{ participantId: 'p1' }]))
      .mockReturnValueOnce(buildSelectMock([{ participantId: 'p1' }]));

    const body = await expectJson<{ users: Array<{ id: string }> }>(await GET());

    expect(body.users.map((u) => u.id)).toEqual(['a1', 'j1', 'p1']);
  });

  it('skips the judge and participant queries when there are none', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'a1', role: 'admin' }], []);
    dbMock.selectDistinct
      .mockReturnValueOnce(buildSelectMock([]))
      .mockReturnValueOnce(buildSelectMock([]));

    const body = await expectJson<{ users: Array<{ id: string }> }>(await GET());

    expect(body.users.map((u) => u.id)).toEqual(['a1']);
    expect(dbMock.select).toHaveBeenCalledTimes(2);
  });
});
