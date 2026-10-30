'use client';

/**
 * Learner Lesson Page — Lesson Viewer
 *
 * Loads lesson content, displays text and/or video, and tracks completion.
 *
 * This component:
 * 1. Defines the route parameters and data structures used by the lesson viewer.
 * 2. Initializes navigation, lesson, course, and progress state.
 * 3. Loads lesson details, course navigation, and saved learner progress.
 * 4. Handles lesson completion and saves progress through the API.
 * 5. Displays loading and error states while preparing the lesson view.
 * 6. Renders the lesson content, course navigation, completion controls, and next-lesson links.
 *
 * Uses Sanity Portable Text for lesson material and LessonVideoPlayer for on-demand Mux playback.
 */

import { useEffect, useState } from 'react';
import LessonVideoPlayer from './LessonVideoPlayer';
import { PortableText } from '@portabletext/react';
import { apiFetch } from '@/lib/api/client';
import { usePathname, useRouter } from 'next/navigation';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// 1. Define the route parameters and response structures used throughout the lesson viewer.

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
  thumbnailUrl: string | null;
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

type CourseNavigatorData = {
  course: { id: string; title: string; slug: string };
  modules: { id: string; title: string; slug: string; order: number | null }[];
  lessons: {
    id: string;
    moduleId: string;
    title: string;
    slug: string;
    order: number | null;
    sanityDocumentId: string | null;
  }[];
};

export default function LessonPage({ params }: LessonPageProps) {
  // 2. Initialize routing and state for the lesson, course outline, navigation, and learner progress.
  const router = useRouter();
  const pathname = usePathname();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [courseSlug, setCourseSlug] = useState<string | null>(null);
  const [nextLesson, setNextLesson] = useState<{
    id: string;
    title: string;
    slug: string;
    moduleSlug: string;
  } | null>(null);
  const [courseData, setCourseData] = useState<CourseNavigatorData | null>(null);
  const [progressRecords, setProgressRecords] = useState<LearnerProgress[]>([]);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 3. Load the lesson while retrieving course navigation and saved progress independently.
  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      setError(null);
      setLesson(null);
      setNextLesson(null);
      setCourseData(null);
      setProgressRecords([]);
      setCompleted(false);

      try {
        const { courseSlug, moduleSlug, lessonSlug } = await params;
        if (cancelled) return;

        setCourseSlug(courseSlug);

        // Retrieve the course outline in the background so it does not delay the lesson content.
        void (async () => {
          try {
            const response = await fetch(`/api/learner/courses/${encodeURIComponent(courseSlug)}`);
            if (!response.ok) return;

            const data: CourseNavigatorData = await response.json();
            if (
              cancelled ||
              !data?.course ||
              !Array.isArray(data.modules) ||
              !Array.isArray(data.lessons)
            )
              return;

            setCourseData(data);
            const currentModule = data.modules.find((item) => item.slug === moduleSlug);
            setExpandedModules(currentModule ? { [currentModule.id]: true } : {});
          } catch (navigatorError) {
            if (!cancelled) console.error('Unable to load course outline:', navigatorError);
          }
        })();

        // Retrieve progress once and reuse the records for the sidebar and current lesson status.
        void (async () => {
          try {
            const response = await fetch('/api/learner/progress');
            if (!response.ok) return;

            const result = await response.json();
            const records = Array.isArray(result) ? result : result?.data;
            if (!cancelled && Array.isArray(records)) setProgressRecords(records);
          } catch (progressError) {
            if (!cancelled) console.error('Unable to load learner progress:', progressError);
          }
        })();

        const query = new URLSearchParams({ courseSlug, moduleSlug });
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

        // Store the lesson response immediately; video playback credentials are requested only when Play is selected.
        setLesson(lessonData);
      } catch (err) {
        if (cancelled) return;
        console.error('Error loading lesson:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    }

    void loadLesson();

    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!lesson) return;
    const record = progressRecords.find((item) => item.lessonId === lesson.lesson.id);
    setCompleted(record?.completed === true);
  }, [lesson, progressRecords]);

  // 4. Save the learner's lesson completion and update the completion state after the API succeeds.
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

  // 5. Handle lesson loading failures and preserve the page layout while lesson data is unavailable.
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

  if (!lesson) {
    return (
      <main className="w-full min-w-0 p-0">
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)]">
          {/* Sidebar skeleton reserves the course navigation space. */}
          <aside className="border-b border-border bg-card lg:sticky lg:top-[73px] lg:h-[calc(100dvh-73px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div className="space-y-3 border-b border-border p-5">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>

            <div className="space-y-3 p-4" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </aside>

          {/* Main content skeleton mirrors the loaded page's dimensions. */}
          <div className="min-w-0 lg:h-[calc(100dvh-73px)] lg:overflow-y-auto">
            <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8 xl:p-10">
              <div className="h-5 w-20 animate-pulse rounded bg-muted" />

              <section className="space-y-4">
                <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                <div className="h-10 w-3/4 max-w-lg animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 max-w-md animate-pulse rounded bg-muted" />
              </section>

              {/* Matches the video's 16:9 aspect ratio. */}
              <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted" />

              <section className="space-y-5 rounded-2xl border border-border p-6 md:p-10">
                <div className="h-6 w-48 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
              </section>

              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Determine whether the lesson should display video, text, or both content formats.
  const format = lesson.content.lessonFormat;
  const needsVideo = format === 'video' || format === 'both';
  const needsText = format === 'text' || format === 'both';

  // 6. Render the course outline, lesson content, completion controls, and lesson navigation.
  return (
    <main className="w-full min-w-0 p-0">
      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* Course sidebar with expandable modules and lesson completion indicators. */}
        <aside className="border-b border-border bg-card lg:sticky lg:top-[73px] lg:h-[calc(100dvh-73px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <BookOpen className="h-4 w-4" />
              Course contents
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug">
              {courseData?.course.title ?? 'Course outline'}
            </h2>
            {courseData && (
              <p className="mt-1 text-xs text-muted-foreground">
                {courseData.lessons.length} {courseData.lessons.length === 1 ? 'lesson' : 'lessons'}
              </p>
            )}
          </div>

          {courseData ? (
            <nav aria-label="Course lessons" className="space-y-2 p-3">
              {courseData.modules
                .slice()
                .sort(
                  (a, b) =>
                    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
                )
                .map((module) => {
                  const isExpanded = Boolean(expandedModules[module.id]);
                  const moduleLessons = courseData.lessons
                    .filter((item) => item.moduleId === module.id)
                    .sort(
                      (a, b) =>
                        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
                    );

                  return (
                    <section key={module.id} className="overflow-hidden rounded-lg">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedModules((current) => ({
                            ...current,
                            [module.id]: !current[module.id],
                          }))
                        }
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm font-semibold transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">{module.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {moduleLessons.length}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="ml-3 space-y-1 border-l border-border py-1 pl-2">
                          {moduleLessons.map((item) => {
                            const href = `/learner/courses/${courseData.course.slug}/module/${module.slug}/lessons/${item.slug}`;
                            const isCurrent = pathname === href;
                            const isComplete = progressRecords.some(
                              (record) => record.lessonId === item.id && record.completed
                            );

                            return (
                              <Link
                                key={item.id}
                                href={href}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={`flex items-start gap-2 rounded-md px-2.5 py-2.5 text-sm transition hover:bg-muted ${isCurrent ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                              >
                                {isComplete ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                                ) : (
                                  <Circle className="mt-0.5 h-4 w-4 shrink-0" />
                                )}
                                <span className="min-w-0 flex-1 break-words">{item.title}</span>
                              </Link>
                            );
                          })}
                          {moduleLessons.length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              No lessons in this module yet.
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  );
                })}
            </nav>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">
              Course contents are unavailable right now.
            </p>
          )}

          <div className="border-t border-border p-4">
            <Link
              href="/learner/courses"
              className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
              ← All courses
            </Link>
          </div>
        </aside>

        <div className="min-w-0 lg:h-[calc(100dvh-73px)] lg:overflow-y-auto">
          <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8 xl:p-10">
            {/* Return to the previous page. */}
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {/* Display the lesson title, description, and content format. */}
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

            {/* Display the video player only for video-based lessons; playback initializes on demand. */}
            {needsVideo && (
              <section className="overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
                <LessonVideoPlayer
                  lessonId={lesson.lesson.id}
                  thumbnailUrl={lesson.thumbnailUrl ?? null}
                />
              </section>
            )}

            {/* Display Sanity Portable Text when the lesson includes written material. */}
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

            {/* Show the learner's completion status and provide the completion action. */}
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

            {/* Provide links to the course catalogue, next lesson, or course overview. */}
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
          </div>
        </div>
      </div>
    </main>
  );
}
