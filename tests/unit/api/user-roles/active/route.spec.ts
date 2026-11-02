import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/user-roles/active/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  signInAs,
  signOut,
  fakeUser,
  type AuthServerMock,
} from '@/tests/unit/test-utils/route-harness';
import {
  resetDbMock,
  mockSelectSequence,
  buildMutationMock,
  buildFailingMutationMock,
  type DbMock,
} from '@/tests/unit/test-utils/mock-db';
import { expectApiError } from '@/tests/unit/test-utils/route-harness';

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

function request(body: unknown) {
  return new Request('http://localhost/api/user-roles/active', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(mockDb);
  signOut(auth);
});

describe('PATCH /api/user-roles/active', () => {
  it('returns 401 when unauthenticated', async () => {
    const response = await PATCH(request({ role: 'judge' }));
    await expectApiError(response, 401, 'BAD_REQUEST');
  });

  it('returns 400 for an invalid role', async () => {
    signInAs(auth, fakeUser('learner'));
    const response = await PATCH(request({ role: 'invalid-role' }));
    await expectApiError(response, 400, 'BAD_REQUEST');
  });

  it('returns 400 when the role is missing', async () => {
    signInAs(auth, fakeUser('learner'));
    const response = await PATCH(request({}));
    await expectApiError(response, 400, 'BAD_REQUEST');
  });

  it('returns 400 for malformed JSON', async () => {
    signInAs(auth, fakeUser('learner'));
    const malformedRequest = new Request('http://localhost/api/user-roles/active', {
      method: 'PATCH',
      body: '{invalid',
    });

    const response = await PATCH(malformedRequest);
    await expectApiError(response, 400, 'BAD_REQUEST');
  });

  it('returns 403 when the user is not assigned the requested role', async () => {
    signInAs(auth, fakeUser('learner'));
    mockSelectSequence(mockDb.select, []);

    const response = await PATCH(request({ role: 'judge' }));

    await expectApiError(response, 403, 'BAD_REQUEST');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updates the active role when the user has the assignment', async () => {
    signInAs(auth, fakeUser('learner'));
    mockSelectSequence(mockDb.select, [{ role: 'judge' }]);
    mockDb.update.mockReturnValueOnce(buildMutationMock([{ activeRole: 'judge' }]));

    const response = await PATCH(request({ role: 'judge' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ activeRole: 'judge' });
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the user account cannot be updated', async () => {
    signInAs(auth, fakeUser('learner'));
    mockSelectSequence(mockDb.select, [{ role: 'judge' }]);
    mockDb.update.mockReturnValueOnce(buildMutationMock([]));

    const response = await PATCH(request({ role: 'judge' }));

    await expectApiError(response, 404, 'BAD_REQUEST');
  });

  it('handles database errors while checking role assignment', async () => {
    signInAs(auth, fakeUser('learner'));
    mockDb.select.mockImplementationOnce(() => {
      throw new Error('Database unavailable');
    });

    const response = await PATCH(request({ role: 'judge' }));

    expect(response.status).toBe(500);
  });

  it('handles database errors while updating the active role', async () => {
    signInAs(auth, fakeUser('learner'));

    mockSelectSequence(mockDb.select, [{ role: 'judge' }]);

    mockDb.update.mockReturnValueOnce(buildFailingMutationMock(new Error('Database unavailable')));

    const response = await PATCH(request({ role: 'judge' }));

    expect(response.status).toBe(500);
  });
});
