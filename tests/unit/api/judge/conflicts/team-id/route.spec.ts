import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '@/app/api/judge/conflicts/[teamId]/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { mockRequest } from '@/tests/unit/test-utils/mock-request';
import {
  mockSelectSequence,
  resetDbMock,
  buildMutationMock,
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

const context = {
  params: Promise.resolve({ teamId: 'team-1' }),
};

const get = (query = '?eventId=event-1') =>
  GET(mockRequest(`/api/judge/conflicts/team-1${query}`), context);

const put = (body: unknown) =>
  PUT(
    mockRequest('/api/judge/conflicts/team-1', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
    context
  );

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('judge'));
});

describe('GET /api/judge/conflicts/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await get(), 403, 'FORBIDDEN');
  });

  it('400 when the judge has no active event', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(await get(), 400, 'NO_ACTIVE_EVENT');
  });

  it('403 when the judge is not assigned to the event', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-2' }]);
    await expectApiError(await get(), 403, 'NOT_ASSIGNED');
  });

  it('404 when the team does not belong to the event', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], []);
    await expectApiError(await get(), 404, 'TEAM_NOT_FOUND');
  });

  it('returns null when no declaration exists', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], [{ id: 'team-1' }], []);

    expect(await expectJson(await get())).toEqual({
      hasConflict: null,
      updatedAt: null,
    });
  });

  it('returns the existing declaration', async () => {
    const updatedAt = '2026-11-10T20:00:00.000Z';

    mockSelectSequence(
      dbMock.select,
      [{ id: 'event-1' }],
      [{ id: 'team-1' }],
      [{ hasConflict: true, updatedAt }]
    );

    expect(await expectJson(await get())).toEqual({
      hasConflict: true,
      updatedAt,
    });
  });
});

describe('PUT /api/judge/conflicts/[teamId]', () => {
  it('401 when unauthenticated', async () => {
    signOut(auth);
    await expectApiError(await put({ eventId: 'event-1', hasConflict: true }), 401, 'UNAUTHORIZED');
  });

  it('403 for an admin', async () => {
    signInAs(auth, fakeUser('admin'));
    await expectApiError(await put({ eventId: 'event-1', hasConflict: true }), 403, 'FORBIDDEN');
  });

  it('400 for invalid JSON', async () => {
    const request = mockRequest('/api/judge/conflicts/team-1', {
      method: 'PUT',
      body: '{invalid json',
    });

    await expectApiError(await PUT(request, context), 400, 'BAD_REQUEST');
  });

  it('400 when the request body is invalid', async () => {
    await expectApiError(await put(null), 400, 'BAD_REQUEST');
  });

  it('400 when hasConflict is not a boolean', async () => {
    await expectApiError(
      await put({ eventId: 'event-1', hasConflict: 'yes' }),
      400,
      'INVALID_CONFLICT_OF_INTEREST'
    );
  });

  it('400 when eventId has an invalid type', async () => {
    await expectApiError(await put({ eventId: 123, hasConflict: true }), 400, 'BAD_REQUEST');
  });

  it('400 when the judge has no active event', async () => {
    mockSelectSequence(dbMock.select, []);
    await expectApiError(
      await put({ eventId: 'event-1', hasConflict: true }),
      400,
      'NO_ACTIVE_EVENT'
    );
  });

  it('403 when the judge is not assigned to the event', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-2' }]);
    await expectApiError(await put({ eventId: 'event-1', hasConflict: true }), 403, 'NOT_ASSIGNED');
  });

  it('404 when the team does not belong to the event', async () => {
    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], []);
    await expectApiError(
      await put({ eventId: 'event-1', hasConflict: true }),
      404,
      'TEAM_NOT_FOUND'
    );
  });

  it('saves a conflict declaration', async () => {
    const updatedAt = '2026-11-10T20:00:00.000Z';

    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], [{ id: 'team-1' }]);

    dbMock.insert.mockReturnValueOnce(buildMutationMock([{ hasConflict: true, updatedAt }]));

    expect(await expectJson(await put({ eventId: 'event-1', hasConflict: true }))).toEqual({
      success: true,
      hasConflict: true,
      updatedAt,
    });

    expect(dbMock.insert).toHaveBeenCalledTimes(1);
  });

  it('saves a no-conflict declaration', async () => {
    const updatedAt = '2026-11-10T20:00:00.000Z';

    mockSelectSequence(dbMock.select, [{ id: 'event-1' }], [{ id: 'team-1' }]);

    dbMock.insert.mockReturnValueOnce(buildMutationMock([{ hasConflict: false, updatedAt }]));

    expect(await expectJson(await put({ eventId: 'event-1', hasConflict: false }))).toEqual({
      success: true,
      hasConflict: false,
      updatedAt,
    });
  });
});
