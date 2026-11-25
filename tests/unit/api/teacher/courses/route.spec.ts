import { GET, POST } from '@/app/api/teacher/courses/route';

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  signInAs(auth, fakeUser('teacher'));
});

describe('/api/teacher/courses', () => {
  it('rejects unauthenticated requests', async () => {
    signOut(auth);
    await expectApiError(await GET(), 401, 'UNAUTHORIZED');
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('lists courses', async () => {
    const courses = [{ id: 'c1', title: 'Course', slug: 'course' }];
    mockSelectSequence(dbMock.select, courses);
    expect(await expectJson(await GET())).toEqual(courses);
  });

  it('creates a course with a generated slug', async () => {
    const created = { id: 'c1', title: 'New Course', description: null, slug: 'new-course' };
    mockSelectSequence(dbMock.select, []);
    dbMock.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([created]) }),
    } as never);
    const response = await POST(
      new Request('http://localhost/api/teacher/courses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: ' New Course ' }),
      })
    );
    expect(response.status).toBe(201);
    expect(await expectJson(response, 201)).toEqual(created);
  });

  it('validates a missing title', async () => {
    await expectApiError(
      await POST(
        new Request('http://localhost/api/teacher/courses', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
      ),
      422,
      'VALIDATION_ERROR'
    );
  });
});
