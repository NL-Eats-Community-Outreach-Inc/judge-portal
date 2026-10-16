import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/lessons/[lessonsId]/route';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { sanityServerClient } from '@/lib/sanity/server-client';
import { mockRequest, mockParams } from '@/tests/unit/test-utils/mock-request';
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

vi.mock('@/lib/sanity/server-client', () => ({
  sanityServerClient: {
    fetch: vi.fn(),
  },
}));

const auth = authServer as unknown as AuthServerMock;
const dbMock = db as unknown as DbMock;
const sanityFetch = sanityServerClient.fetch as unknown as ReturnType<typeof vi.fn>;

const params = mockParams({ lessonsId: 'lesson-1' });

const get = () => GET(mockRequest('/api/learner/lessons/lesson-1'), params);

const lesson = {
  id: 'lesson-1',
  moduleId: 'module-1',
  title: 'Your First Program',
  description: 'Learn the basics.',
  sanityDocumentId: 'sanity-lesson-1',
};

const sanityContent = {
  _id: 'sanity-lesson-1',
  title: 'Your First Program',
  content: [],
  videoContent: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  sanityFetch.mockReset();
  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/lessons/[lessonsId]', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'BAD_REQUEST');
  });

  it('returns 404 when the lesson does not exist', async () => {
    mockSelectSequence(dbMock.select, []);

    await expectApiError(await get(), 404, 'NOT_FOUND');

    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 404 when the lesson has no Sanity document ID', async () => {
    mockSelectSequence(dbMock.select, [{ ...lesson, sanityDocumentId: null }]);

    await expectApiError(await get(), 404, 'NOT_FOUND');

    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 404 when Sanity content does not exist', async () => {
    mockSelectSequence(dbMock.select, [lesson], [{ id: 'module-1', courseId: 'course-1' }], []);

    sanityFetch.mockResolvedValue(null);

    await expectApiError(await get(), 404, 'NOT_FOUND');

    expect(sanityFetch).toHaveBeenCalledOnce();
  });

  it('returns the lesson, Sanity content, and navigation', async () => {
    const module = {
      id: 'module-1',
      courseId: 'course-1',
    };

    const nextLesson = {
      id: 'lesson-2',
      title: 'Variables',
      order: 2,
      moduleId: 'module-1',
    };

    mockSelectSequence(dbMock.select, [lesson], [module], [nextLesson]);

    sanityFetch.mockResolvedValue(sanityContent);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      lesson,
      content: sanityContent,
      navigation: {
        courseId: 'course-1',
        nextLessonId: 'lesson-2',
        nextLessonTitle: 'Variables',
      },
    });

    expect(sanityFetch).toHaveBeenCalledOnce();
    expect(sanityFetch.mock.calls[0][1]).toEqual({
      sanityDocumentId: lesson.sanityDocumentId,
    });
  });

  it('returns null next-lesson fields when there is no next lesson', async () => {
    const module = {
      id: 'module-1',
      courseId: 'course-1',
    };

    mockSelectSequence(dbMock.select, [lesson], [module], []);

    sanityFetch.mockResolvedValue(sanityContent);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      lesson,
      content: sanityContent,
      navigation: {
        courseId: 'course-1',
        nextLessonId: null,
        nextLessonTitle: null,
      },
    });
  });

  it('returns a null courseId when the module is missing', async () => {
    mockSelectSequence(dbMock.select, [lesson], [], []);

    sanityFetch.mockResolvedValue(sanityContent);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      lesson,
      content: sanityContent,
      navigation: {
        courseId: null,
        nextLessonId: null,
        nextLessonTitle: null,
      },
    });
  });

  it('handles database errors', async () => {
    dbMock.select.mockImplementation(() => {
      throw new Error('Database unavailable');
    });

    const response = await get();

    expect(response.status).toBe(500);
  });

  it('handles Sanity fetch errors', async () => {
    mockSelectSequence(dbMock.select, [lesson], [{ id: 'module-1', courseId: 'course-1' }], []);

    sanityFetch.mockRejectedValue(new Error('Sanity unavailable'));

    const response = await get();

    expect(response.status).toBe(500);
  });
});
