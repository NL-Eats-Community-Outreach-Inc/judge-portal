import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/learner/progress/route';
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

const get = () => GET();

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/learner/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

const progress = [
  {
    id: 'progress-1',
    userId: 'learner-1',
    lessonId: 'lesson-1',
    completed: true,
    createdAt: '2026-10-09T12:00:00.000Z',
    updatedAt: '2026-10-09T12:00:00.000Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/progress', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'BAD_REQUEST');
  });

  it('returns the signed-in learner progress', async () => {
    mockSelectSequence(dbMock.select, progress);

    const response = await get();

    expect(await expectJson(response)).toEqual(progress);
  });

  it('returns an empty array when no progress exists', async () => {
    mockSelectSequence(dbMock.select, []);

    const response = await get();

    expect(await expectJson(response)).toEqual([]);
  });
});

describe('POST /api/learner/progress', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await post({ lessonId: 'lesson-1' }), 401, 'BAD_REQUEST');
  });

  it('returns 400 when lessonId is missing', async () => {
    const response = await post({});

    await expectApiError(response, 400, 'BAD_REQUEST');
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('saves completed progress for the signed-in learner', async () => {
    const savedProgress = progress[0];

    const returning = vi.fn().mockResolvedValue([savedProgress]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });

    dbMock.insert.mockReturnValue({ values } as never);

    const response = await post({ lessonId: 'lesson-1' });

    expect(await expectJson(response)).toEqual({
      message: 'Progress updated',
      progress: savedProgress,
    });

    expect(dbMock.insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith({
      userId: 'learner-1',
      lessonId: 'lesson-1',
      completed: true,
    });

    expect(onConflictDoUpdate).toHaveBeenCalledOnce();

    const conflictConfig = onConflictDoUpdate.mock.calls[0][0];

    expect(conflictConfig.set).toMatchObject({
      completed: true,
    });
    expect(conflictConfig.target).toHaveLength(2);
  });
});
