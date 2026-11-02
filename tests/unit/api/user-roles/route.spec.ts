import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/user-roles/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  signInAs,
  signOut,
  fakeUser,
  type AuthServerMock,
  expectApiError,
} from '@/tests/unit/test-utils/route-harness';
import {
  resetDbMock,
  mockSelectSequence,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';

vi.mock('@/lib/auth', async () => {
  const { buildAuthServerMock } = await import('@/tests/unit/test-utils/route-harness');
  return { authServer: buildAuthServerMock() };
});

vi.mock('@/lib/db', async () => {
  const { buildDbMock } = await import('@/tests/unit/test-utils/mock-db');
  return { db: buildDbMock() };
});

const auth = authServer as unknown as AuthServerMock;
const mockDb = db as unknown as DbMock;

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(mockDb);
  signOut(auth);
});

describe('GET /api/user-roles', () => {
  it('returns 401 when unauthenticated', async () => {
    const response = await GET();

    await expectApiError(response, 401, 'BAD_REQUEST');
  });

  it('returns 404 when the user account does not exist', async () => {
    signInAs(auth, fakeUser('learner'));
    mockSelectSequence(mockDb.select, []);

    const response = await GET();

    await expectApiError(response, 404, 'BAD_REQUEST');
  });

  it('returns the active role and all assigned roles', async () => {
    signInAs(auth, fakeUser('learner'));

    mockSelectSequence(
      mockDb.select,
      [{ activeRole: 'learner' }],
      [{ role: 'judge' }, { role: 'learner' }]
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      activeRole: 'learner',
      roles: ['judge', 'learner'],
    });
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it('returns an empty roles array when the user has no assigned roles', async () => {
    signInAs(auth, fakeUser('learner'));

    mockSelectSequence(mockDb.select, [{ activeRole: 'learner' }], []);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      activeRole: 'learner',
      roles: [],
    });
  });

  it('handles database errors while fetching the user account', async () => {
    signInAs(auth, fakeUser('learner'));

    mockDb.select.mockImplementationOnce(() => {
      throw new Error('Database unavailable');
    });

    const response = await GET();

    expect(response.status).toBe(500);
  });

  it('handles database errors while fetching assigned roles', async () => {
    signInAs(auth, fakeUser('learner'));

    mockSelectSequence(mockDb.select, [{ activeRole: 'learner' }]);

    mockDb.select.mockImplementationOnce(() => {
      throw new Error('Database unavailable');
    });

    const response = await GET();

    expect(response.status).toBe(500);
  });
});
