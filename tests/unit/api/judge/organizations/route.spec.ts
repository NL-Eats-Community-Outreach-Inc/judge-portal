import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/judge/organizations/route';
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
  POST(mockRequest('/api/judge/organizations', { method: 'POST', body }));

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/organizations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await GET(), 403, 'FORBIDDEN');
  });

  it('lists the judge’s memberships', async () => {
    const rows = [{ orgId: 'org-1', orgName: 'NL Eats', orgDescription: null, joinedAt: 'x' }];
    mockSelectSequence(dbMock.select, rows);
    expect(await expectJson(await GET())).toEqual({ memberships: rows });
  });
});

describe('POST /api/judge/organizations', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await post({ organizationIds: ['org-1'] }), 401, 'UNAUTHORIZED');
  });

  it('403 for a participant', async () => {
    signInAs(auth, fakeUser('participant'));
    await expectApiError(await post({ organizationIds: ['org-1'] }), 403, 'FORBIDDEN');
  });

  it('400 without organization ids', async () => {
    await expectApiError(await post({ organizationIds: [] }), 400, 'BAD_REQUEST');
    await expectApiError(await post({}), 400, 'BAD_REQUEST');
  });

  it('400 when an organization does not exist', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }]);
    await expectApiError(await post({ organizationIds: ['org-1', 'org-9'] }), 400, 'BAD_REQUEST');
  });

  it('joins the organizations the judge is not yet a member of', async () => {
    mockSelectSequence(
      dbMock.select,
      [{ id: 'org-1' }, { id: 'org-2' }],
      [{ organizationId: 'org-1' }]
    );
    const insert = buildAssertableMutationMock([]);
    dbMock.insert.mockReturnValue(insert.insertMock);

    const body = await expectJson(await post({ organizationIds: ['org-1', 'org-2'] }));

    expect(body).toEqual({ joined: 1, alreadyMember: 1 });
    expect(insert.chain.values).toHaveBeenCalledWith([
      { organizationId: 'org-2', userId: 'judge-1' },
    ]);
  });

  it('inserts nothing when every organization is already joined', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'org-1' }], [{ organizationId: 'org-1' }]);
    expect(await expectJson(await post({ organizationIds: ['org-1'] }))).toEqual({
      joined: 0,
      alreadyMember: 1,
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
