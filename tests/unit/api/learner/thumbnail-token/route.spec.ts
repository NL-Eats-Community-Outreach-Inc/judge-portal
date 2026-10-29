import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/learner/lessons/[lessonSlug]/route';
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

const { signPlaybackId } = vi.hoisted(() => ({
  signPlaybackId: vi.fn(),
}));

vi.mock('@mux/mux-node', () => ({
  default: class MockMux {
    jwt = { signPlaybackId };
  },
}));

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

const params = mockParams({ lessonSlug: 'welcome' });

const get = (courseSlug = 'introduction-to-innovation', moduleSlug = 'getting-started') =>
  GET(
    mockRequest(`/api/learner/lessons/welcome?courseSlug=${courseSlug}&moduleSlug=${moduleSlug}`),
    params
  );

const lesson = {
  id: 'lesson-1',
  moduleId: 'module-1',
  title: 'Your First Program',
  description: 'Learn the basics.',
  slug: 'welcome',
  sanityDocumentId: 'sanity-lesson-1',
};

const sanityContent = {
  _id: 'sanity-lesson-1',
  title: 'Your First Program',
  content: [],
  videoContent: null,
};

const module = {
  id: 'module-1',
  courseId: 'course-1',
  slug: 'getting-started',
};

const nextLesson = {
  id: 'lesson-2',
  title: 'Variables',
  slug: 'variables',
  order: 2,
  moduleId: 'module-1',
};

const joinedLesson = { lesson };

beforeEach(() => {
  vi.clearAllMocks();
  resetDbMock(dbMock);
  sanityFetch.mockReset();
  signPlaybackId.mockReset();
  signInAs(auth, fakeUser('learner'));
});

describe('GET /api/learner/lessons/[lessonSlug]', () => {
  it('returns 401 when unauthenticated', async () => {
    signOut(auth);

    await expectApiError(await get(), 401, 'UNAUTHORIZED');
  });

  it('returns 400 when courseSlug is missing', async () => {
    const response = await GET(mockRequest('/api/learner/lessons/welcome'), params);

    await expectApiError(response, 400, 'BAD_REQUEST');
    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 404 when the lesson does not exist in the requested course', async () => {
    mockSelectSequence(dbMock.select, []);

    await expectApiError(await get(), 404, 'NOT_FOUND');
    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 404 when the lesson has no Sanity document ID', async () => {
    mockSelectSequence(dbMock.select, [{ lesson: { ...lesson, sanityDocumentId: null } }]);

    await expectApiError(await get(), 404, 'NOT_FOUND');
    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 404 when Sanity content does not exist', async () => {
    mockSelectSequence(dbMock.select, [joinedLesson], [module], []);

    sanityFetch.mockResolvedValue(null);

    await expectApiError(await get(), 404, 'NOT_FOUND');
    expect(sanityFetch).toHaveBeenCalledOnce();
  });

  it('returns 400 when courseSlug is missing', async () => {
    const response = await GET(
      mockRequest('/api/learner/lessons/welcome?moduleSlug=getting-started'),
      params
    );

    await expectApiError(response, 400, 'BAD_REQUEST');
    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns 400 when moduleSlug is missing', async () => {
    const response = await GET(
      mockRequest('/api/learner/lessons/welcome?courseSlug=introduction-to-innovation'),
      params
    );

    await expectApiError(response, 400, 'BAD_REQUEST');
    expect(sanityFetch).not.toHaveBeenCalled();
  });

  it('returns the lesson, Sanity content, and navigation', async () => {
    mockSelectSequence(dbMock.select, [joinedLesson], [module], [nextLesson]);

    sanityFetch.mockResolvedValue(sanityContent);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      lesson,
      content: sanityContent,
      thumbnailUrl: null,
      navigation: {
        courseId: 'course-1',
        nextLessonId: 'lesson-2',
        nextLessonTitle: 'Variables',
        nextLessonSlug: 'variables',
        nextModuleSlug: 'getting-started',
      },
    });

    expect(sanityFetch).toHaveBeenCalledOnce();
    expect(sanityFetch.mock.calls[0][1]).toEqual({
      sanityDocumentId: lesson.sanityDocumentId,
    });
  });

  it('returns null next-lesson fields when there is no next lesson', async () => {
    mockSelectSequence(dbMock.select, [joinedLesson], [module], []);

    sanityFetch.mockResolvedValue(sanityContent);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      lesson,
      content: sanityContent,
      thumbnailUrl: null,
      navigation: {
        courseId: 'course-1',
        nextLessonId: null,
        nextLessonTitle: null,
        nextLessonSlug: null,
        nextModuleSlug: 'getting-started',
      },
    });
  });

  it('returns a null courseId when the module is missing', async () => {
    mockSelectSequence(dbMock.select, [joinedLesson], [], []);

    sanityFetch.mockResolvedValue(sanityContent);

    const response = await get();

    expect(await expectJson(response)).toEqual({
      lesson,
      content: sanityContent,
      thumbnailUrl: null,
      navigation: {
        courseId: null,
        nextLessonId: null,
        nextLessonTitle: null,
        nextLessonSlug: null,
        nextModuleSlug: null,
      },
    });
  });

  it('returns a signed thumbnail URL for video lessons', async () => {
    mockSelectSequence(dbMock.select, [joinedLesson], [module], [nextLesson]);
    sanityFetch.mockResolvedValue({
      ...sanityContent,
      lessonFormat: 'video',
      videoContent: { asset: { playbackId: 'mux-playback-123' } },
    });
    signPlaybackId.mockResolvedValue('signed-thumbnail-token');

    const response = await get();
    const body = await expectJson(response);

    expect(body.thumbnailUrl).toBe(
      'https://image.mux.com/mux-playback-123/thumbnail.jpg?time=5&width=1280&height=720&token=signed-thumbnail-token'
    );
    expect(signPlaybackId).toHaveBeenCalledWith('mux-playback-123', {
      type: 'thumbnail',
      params: { time: '5', width: '1280', height: '720' },
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
    mockSelectSequence(dbMock.select, [joinedLesson], [module], []);

    sanityFetch.mockRejectedValue(new Error('Sanity unavailable'));

    const response = await get();

    expect(response.status).toBe(500);
  });
});
