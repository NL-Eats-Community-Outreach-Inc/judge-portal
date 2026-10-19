'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  GraduationCap,
  Layers3,
} from 'lucide-react';

type Lesson = {
  id: string;
  moduleId: string;
  sanityDocumentId: string | null;
  title: string;
  description: string | null;
  order: number | null;
  createdAt: string;
};

type Module = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number | null;
  createdAt: string;
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type CourseDetail = {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
};

type LearnerProgress = {
  lessonId: string;
  completed: boolean;
};

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);

  const [courseData, setCourseData] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      try {
        setLoading(true);
        setError(null);

        const [courseResponse, progressResponse] = await Promise.all([
          fetch(`/api/learner/courses/${courseId}`),
          fetch('/api/learner/progress'),
        ]);

        const courseResult = await courseResponse.json();

        if (!courseResponse.ok) {
          throw new Error(courseResult.error_message || 'Failed to load course');
        }

        if (cancelled) return;

        setCourseData(courseResult as CourseDetail);

        // Progress is useful, but should not prevent the course
        // from loading if the progress endpoint fails.

        if (progressResponse.ok) {
          const progressResult = await progressResponse.json();

          const records = Array.isArray(progressResult) ? progressResult : progressResult.data;

          if (!cancelled && Array.isArray(records)) {
            setProgress(records);
          } else {
            console.error('Unexpected progress response:', progressResult);
          }
        } else {
          console.error('Failed to fetch learner progress:', progressResponse.status);
        }

        // Expand the first module by default.
        const modules: Module[] = courseResult.modules ?? [];

        if (!cancelled && modules.length > 0) {
          setOpenModules({ [modules[0].id]: true });
        }
      } catch (err) {
        if (cancelled) return;

        console.error('Error loading course:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const completedLessonIds = useMemo(
    () => new Set(progress.filter((item) => item.completed).map((item) => item.lessonId)),
    [progress]
  );

  const sortedModules = useMemo(
    () =>
      [...(courseData?.modules ?? [])].sort(
        (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      ),
    [courseData]
  );

  const sortedLessons = useMemo(
    () =>
      [...(courseData?.lessons ?? [])].sort(
        (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
      ),
    [courseData]
  );

  const completedCount = sortedLessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;

  const totalLessons = sortedLessons.length;

  const completionPercentage =
    totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  function toggleModule(moduleId: string) {
    setOpenModules((current) => ({
      ...current,
      [moduleId]: !current[moduleId],
    }));
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl p-6 md:p-10">
        <p className="text-muted-foreground">Loading course...</p>
      </main>
    );
  }

  if (error || !courseData) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6 md:p-10">
        <Link
          href="/learner"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Learning
        </Link>

        <h1 className="text-2xl font-semibold">Unable to load course</h1>

        <p role="alert" className="text-destructive">
          {error || 'This course could not be found.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
      {/* Back navigation */}
      <Link
        href="/learner"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All courses
      </Link>

      {/* Course heading */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-gradient-to-br from-violet-600/20 via-purple-500/10 to-background p-6 md:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/80 shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>

          <p className="mt-5 text-sm font-medium text-primary">COURSE OVERVIEW</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {courseData.course.title}
          </h1>

          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            {courseData.course.description || 'Explore the modules and lessons in this course.'}
          </p>
        </div>

        {/* Progress summary */}
        <div className="grid gap-5 border-t border-border p-6 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <Layers3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{sortedModules.length}</p>
              <p className="text-sm text-muted-foreground">
                {sortedModules.length === 1 ? 'Module' : 'Modules'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{totalLessons}</p>
              <p className="text-sm text-muted-foreground">
                {totalLessons === 1 ? 'Lesson' : 'Lessons'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{completionPercentage}%</p>
              <p className="text-sm text-muted-foreground">Course completed</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Your progress</span>
            <span className="font-medium">
              {completedCount} of {totalLessons} lessons
            </span>
          </div>

          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Course completion"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionPercentage}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </section>

      {/* Module list */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Course content</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select a module to view its lessons.</p>
        </div>

        {sortedModules.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Layers3 className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
            <h3 className="font-semibold">No modules yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Course content will appear here when modules are added.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedModules.map((module, index) => {
              const isOpen = !!openModules[module.id];

              const moduleLessons = sortedLessons.filter((lesson) => lesson.moduleId === module.id);

              const moduleCompleted = moduleLessons.filter((lesson) =>
                completedLessonIds.has(lesson.id)
              ).length;

              const modulePercentage =
                moduleLessons.length > 0
                  ? Math.round((moduleCompleted / moduleLessons.length) * 100)
                  : 0;

              return (
                <section
                  key={module.id}
                  className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
                >
                  <button
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-muted/40 sm:p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{module.title}</h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        {moduleLessons.length} {moduleLessons.length === 1 ? 'lesson' : 'lessons'}
                        {moduleLessons.length > 0 && ` · ${moduleCompleted} completed`}
                      </p>

                      {module.description && (
                        <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>
                      )}

                      {moduleLessons.length > 0 && (
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${modulePercentage}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
                      {moduleLessons.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">
                          No lessons in this module yet.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {moduleLessons.map((lesson, lessonIndex) => {
                            const isCompleted = completedLessonIds.has(lesson.id);

                            const lessonContent = (
                              <>
                                <div className="shrink-0">
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">
                                    <span className="mr-2 text-muted-foreground">
                                      {lessonIndex + 1}.
                                    </span>
                                    {lesson.title}
                                  </p>

                                  {lesson.description && (
                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                      {lesson.description}
                                    </p>
                                  )}
                                </div>

                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              </>
                            );

                            return lesson.sanityDocumentId ? (
                              <Link
                                key={lesson.id}
                                href={`/learner/lessons/${lesson.id}`}
                                className="flex items-center gap-3 rounded-lg p-3 transition hover:bg-background hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {lessonContent}
                              </Link>
                            ) : (
                              <div
                                key={lesson.id}
                                className="flex cursor-not-allowed items-center gap-3 rounded-lg p-3 opacity-50"
                                title="Lesson content is not available yet"
                              >
                                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">
                                    <span className="mr-2 text-muted-foreground">
                                      {lessonIndex + 1}.
                                    </span>
                                    {lesson.title}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Content unavailable
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex justify-start border-t border-border pt-5">
        <Link
          href="/learner"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all courses
        </Link>
      </div>
    </main>
  );
}
