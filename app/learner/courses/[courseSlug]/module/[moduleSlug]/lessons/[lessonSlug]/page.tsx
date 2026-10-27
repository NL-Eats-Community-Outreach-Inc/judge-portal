'use client';

/**
 * Learner Lesson Page — Lesson Viewer
 *
 * Loads lesson content, displays text and/or video, and tracks completion.
 *
 * This component:
 * 1. Defines the lesson data types and initializes viewer state.
 * 2. Loads lesson details, navigation, video credentials, and saved progress.
 * 3. Handles lesson completion and saves progress through the API.
 * 4. Displays loading and error states.
 * 5. Renders the lesson heading and content based on its format.
 * 6. Provides completion controls and navigation to other lessons.
 *
 * Uses Sanity Portable Text for lesson material and signed Mux tokens
 * for video playback.
 */

import { useEffect, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { PortableText } from '@portabletext/react';
import { apiFetch } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import type { PortableTextBlock } from '@portabletext/types';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  GraduationCap,
  PlayCircle,
} from 'lucide-react';

// 1. Define the route parameters, lesson response, and saved progress types.

// Next.js dynamic route params for `/learner/lessons/[lessonId]`.
type LessonPageProps = {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
    lessonSlug: string;
  }>;
};

// Saved completion record for the current learner and lesson.
type LearnerProgress = {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

// Combined response containing database metadata, Sanity content, and navigation.
type Lesson = {
  lesson: {
    id: string;
    title: string;
    description: string | null;
    sanityDocumentId: string | null;
    slug: string;
  };
  content: {
    _id: string;
    title: string;
    lessonFormat: 'text' | 'video' | 'both';
    content: PortableTextBlock[];
    videoContent: unknown;
  };
  navigation: {
    courseId: string | null;
    nextLessonId: string | null;
    nextLessonTitle: string | null;
    nextLessonSlug: string | null;
    nextModuleSlug: string | null;
  };
};

export default function LessonPage({ params }: LessonPageProps) {
  // 2. Initialize navigation and state for lesson content, video, and progress.
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [video, setVideo] = useState<{
    token: string;
    playbackId: string;
  } | null>(null);
  const [courseSlug, setCourseSlug] = useState<string | null>(null);
  const [nextLesson, setNextLesson] = useState<{
    id: string;
    title: string;
    slug: string;
    moduleSlug: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 3. Load the lesson, optional video credentials, and saved completion state.
  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      try {
        setError(null);
        setLesson(null);
        setVideo(null);
        setNextLesson(null);

        // Resolve the lesson ID from the dynamic route parameters.
        const { courseSlug, moduleSlug, lessonSlug } = await params;

        setCourseSlug(courseSlug);

        if (cancelled) return;

        const query = new URLSearchParams({
          courseSlug,
          moduleSlug,
        });

        const lessonResponse = await fetch(
          `/api/learner/lessons/${encodeURIComponent(lessonSlug)}?${query.toString()}`
        );

        const lessonData: Lesson & { error_message?: string } = await lessonResponse.json();

        if (!lessonResponse.ok) {
          throw new Error(lessonData.error_message || 'Failed to load lesson');
        }

        if (cancelled) return;

        if (
          lessonData.navigation?.nextLessonId &&
          lessonData.navigation?.nextLessonSlug &&
          lessonData.navigation?.nextModuleSlug
        ) {
          setNextLesson({
            id: lessonData.navigation.nextLessonId,
            title: lessonData.navigation.nextLessonTitle ?? 'Next lesson',
            slug: lessonData.navigation.nextLessonSlug,
            moduleSlug: lessonData.navigation.nextModuleSlug,
          });
        }

        setLesson(lessonData);

        // Request video credentials only for video and combined lessons.
        const format = lessonData.content.lessonFormat;

        const videoPromise =
          format === 'video' || format === 'both'
            ? (async () => {
                const response = await fetch(
                  `/api/learner/video-token?lessonId=${lessonData.lesson.id}`
                );
                const data = await response.json();

                if (!response.ok) {
                  throw new Error(data.error_message || 'Failed to load video');
                }

                return data;
              })()
            : Promise.resolve(null);

        // Fetch saved progress while any required video credentials load.
        const progressPromise = apiFetch<{
          data: LearnerProgress[];
        }>('/api/learner/progress');

        const [videoData, progressResponse] = await Promise.all([videoPromise, progressPromise]);

        if (cancelled) return;

        if (videoData) {
          setVideo(videoData);
        }

        // Restore the completion state for the current lesson.
        const lessonProgress = progressResponse.data.find(
          (item) => item.lessonId === lessonData.lesson.id
        );

        setCompleted(lessonProgress?.completed === true);
      } catch (err) {
        if (cancelled) return;

        console.error('Error loading lesson:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    }

    loadLesson();

    return () => {
      cancelled = true;
    };
  }, [params]);

  // 4. Save lesson completion and update the UI after a successful response.
  const handleLessonComplete = async () => {
    if (!lesson || completing || completed) return;

    try {
      setCompleting(true);

      await apiFetch('/api/learner/progress', {
        method: 'POST',
        body: {
          lessonId: lesson.lesson.id,
        },
      });

      setCompleted(true);
    } catch (err) {
      console.error('Error completing lesson:', err);
      setError(err instanceof Error ? err.message : 'Failed to save lesson progress');
    } finally {
      setCompleting(false);
    }
  };

  // 5. Display an error state if the lesson could not be loaded.
  if (error && !lesson) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6 md:p-10">
        <Link
          href="/learner"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Learning
        </Link>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="text-xl font-semibold">Unable to load lesson</h1>
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        </div>
      </main>
    );
  }

  // 6. Show a loading state while the lesson request is pending.
  if (!lesson) {
    return (
      <main className="mx-auto max-w-5xl p-6 md:p-10">
        <p className="text-muted-foreground">Loading lesson...</p>
      </main>
    );
  }

  // Determine which content sections should appear for this lesson format.
  const format = lesson.content.lessonFormat;
  const needsVideo = format === 'video' || format === 'both';
  const needsText = format === 'text' || format === 'both';

  if (needsVideo && !video) {
    return (
      <main className="mx-auto max-w-5xl p-6 md:p-10">
        <p className="text-muted-foreground">Loading video...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      {/* Navigation */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Lesson heading */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <GraduationCap className="h-5 w-5" />
          Lesson
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {lesson.content.title || lesson.lesson.title}
            </h1>

            {lesson.lesson.description && (
              <p className="max-w-3xl leading-relaxed text-muted-foreground">
                {lesson.lesson.description}
              </p>
            )}
          </div>

          <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium capitalize">
            {format === 'both' ? (
              <BookOpen className="h-4 w-4" />
            ) : format === 'video' ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {format === 'both'
              ? 'Video & text'
              : format === 'video'
                ? 'Video lesson'
                : 'Text lesson'}
          </span>
        </div>
      </section>

      {/* Video comes FIRST, before any text content */}
      {needsVideo && video && (
        <section className="overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
          <MuxPlayer
            playbackId={video.playbackId}
            tokens={{
              playback: video.token,
            }}
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              display: 'block',
            }}
          />
        </section>
      )}

      {/* Text content appears below the video */}
      {needsText && (
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-10">
          <div className="mb-6 flex items-center gap-3 border-b border-border pb-5">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h2 className="text-lg font-semibold">Lesson material</h2>
              <p className="text-sm text-muted-foreground">
                Read through the lesson content below.
              </p>
            </div>
          </div>

          <div className="prose prose-neutral max-w-none break-words dark:prose-invert prose-headings:tracking-tight prose-a:text-primary prose-img:rounded-xl">
            <PortableText value={lesson.content.content ?? []} />
          </div>
        </article>
      )}

      {/* Completion status and action */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {completed ? (
              <CheckCircle2 className="h-7 w-7 shrink-0 text-green-600" />
            ) : (
              <Circle className="h-7 w-7 shrink-0 text-muted-foreground" />
            )}

            <div>
              <h2 className="font-semibold">
                {completed ? 'Lesson completed!' : 'Finished this lesson?'}
              </h2>

              <p className="text-sm text-muted-foreground">
                {completed
                  ? 'Your progress has been saved.'
                  : 'Mark this lesson complete to track your progress.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLessonComplete}
            disabled={completing || completed}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {completed ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </>
            ) : completing ? (
              'Saving progress...'
            ) : (
              <>
                Complete Lesson
                <CheckCircle2 className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      {/* Lesson navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <Link
          href="/learner/courses"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All courses
        </Link>

        {nextLesson && (
          <Link
            href={`/learner/courses/${courseSlug}/module/${nextLesson.moduleSlug}/lessons/${nextLesson.slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <span className="text-left">
              <span className="block">Next lesson</span>
              <span className="block max-w-48 truncate text-xs font-normal text-violet-100">
                {nextLesson.title}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        )}

        {!nextLesson && courseSlug && (
          <Link
            href={`/learner/courses/${courseSlug}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium transition hover:bg-muted"
          >
            Back to course
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </main>
  );
}
