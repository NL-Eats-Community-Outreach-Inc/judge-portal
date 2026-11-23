'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState, type FormEvent } from 'react';
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
  Plus,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';

type Lesson = {
  id: string;
  moduleId: string;
  sanityDocumentId: string | null;
  title: string;
  description: string | null;
  order: number | null;
  createdAt: string;
  slug: string;
};

type Module = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number | null;
  createdAt: string;
  slug: string;
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  slug: string;
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

export default function CoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = use(params);

  const [courseData, setCourseData] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<LearnerProgress[]>([]);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showModuleForm, setShowModuleForm] = useState(false);
  const [activeLessonModuleId, setActiveLessonModuleId] = useState<string | null>(null);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDescription, setLessonDescription] = useState('');
  const [savingModule, setSavingModule] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [managementError, setManagementError] = useState<string | null>(null);
  const [managementSuccess, setManagementSuccess] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCourse() {
      try {
        setLoading(true);
        setError(null);

        const courseResponse = await fetch(
          `/api/teacher/courses/${encodeURIComponent(courseSlug)}`
        );
        const courseResult = await courseResponse.json();

        if (!courseResponse.ok) {
          throw new Error(courseResult.error_message || 'Failed to load course');
        }

        if (cancelled) return;

        setCourseData(courseResult as CourseDetail);

        setProgress([]);

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
  }, [courseSlug]);

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

  async function refreshCourse() {
    const response = await fetch(`/api/teacher/courses/${encodeURIComponent(courseSlug)}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error_message || 'Failed to refresh course.');
    }
    setCourseData(result as CourseDetail);
  }

  async function handleCreateModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseData || !moduleTitle.trim()) return;

    setSavingModule(true);
    setManagementError(null);
    setManagementSuccess(null);

    try {
      const response = await fetch('/api/teacher/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseSlug: courseData.course.slug,
          title: moduleTitle.trim(),
          description: moduleDescription.trim() || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error_message || result.message || 'Failed to create module.');
      }

      const createdModule = result.module ?? result.data ?? result;
      await refreshCourse();
      if (typeof createdModule.id === 'string') {
        setOpenModules((current) => ({ ...current, [createdModule.id]: true }));
      }
      setModuleTitle('');
      setModuleDescription('');
      setShowModuleForm(false);
      setManagementSuccess('Module created successfully.');
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Failed to create module.');
    } finally {
      setSavingModule(false);
    }
  }

  async function handleCreateLesson(event: FormEvent<HTMLFormElement>, moduleSlug: string) {
    event.preventDefault();
    if (!lessonTitle.trim()) return;

    setSavingLesson(true);
    setManagementError(null);
    setManagementSuccess(null);

    try {
      const response = await fetch('/api/teacher/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseSlug: courseData?.course.slug,
          moduleSlug,
          title: lessonTitle.trim(),
          description: lessonDescription.trim() || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error_message || result.message || 'Failed to create lesson.');
      }

      await refreshCourse();
      setLessonTitle('');
      setLessonDescription('');
      setActiveLessonModuleId(null);
      setManagementSuccess('Lesson created. You can now add its learning content.');
    } catch (err) {
      setManagementError(err instanceof Error ? err.message : 'Failed to create lesson.');
    } finally {
      setSavingLesson(false);
    }
  }

  async function handleDeleteLesson(lesson: Lesson) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${lesson.title}"?\n\nThis will also delete the lesson's saved learner progress. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingLessonId(lesson.id);
    setManagementError(null);
    setManagementSuccess(null);

    let deletionSucceeded = false;

    try {
      const response = await fetch(
        `/api/teacher/lessons/${encodeURIComponent(lesson.slug)}?courseSlug=${encodeURIComponent(courseData?.course.slug ?? '')}&moduleSlug=${encodeURIComponent(sortedModules.find((item) => item.id === lesson.moduleId)?.slug ?? '')}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error_message || result.message || 'Failed to delete lesson.');
      }

      deletionSucceeded = true;
      await refreshCourse();

      setManagementSuccess(`"${lesson.title}" was deleted successfully.`);
    } catch (err) {
      setManagementError(
        deletionSucceeded
          ? 'The lesson was deleted, but the course could not be refreshed. Please reload the page.'
          : err instanceof Error
            ? err.message
            : 'Failed to delete lesson.'
      );
    } finally {
      setDeletingLessonId(null);
    }
  }

  async function handleDeleteModule(module: Module) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${module.title}"?\n\nThis will also permanently delete all ${sortedLessons.filter((lesson) => lesson.moduleId === module.id).length} lessons in this module and their saved learner progress. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingModuleId(module.id);
    setManagementError(null);
    setManagementSuccess(null);

    let deletionSucceeded = false;

    try {
      const response = await fetch(
        `/api/teacher/modules/${encodeURIComponent(module.slug)}?courseSlug=${encodeURIComponent(courseData?.course.slug ?? '')}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error_message || result.message || 'Failed to delete module.');
      }

      deletionSucceeded = true;
      await refreshCourse();

      setOpenModules((current) => {
        const next = { ...current };
        delete next[module.id];
        return next;
      });

      if (activeLessonModuleId === module.id) {
        setActiveLessonModuleId(null);
      }

      setManagementSuccess(`Module "${module.title}" and its lessons were deleted successfully.`);
    } catch (err) {
      setManagementError(
        deletionSucceeded
          ? 'The module was deleted, but the course could not be refreshed. Please reload the page.'
          : err instanceof Error
            ? err.message
            : 'Failed to delete module.'
      );
    } finally {
      setDeletingModuleId(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1800px] p-5 sm:p-6 md:p-10">
        <p className="text-sm text-muted-foreground">Loading course...</p>
      </main>
    );
  }

  if (error || !courseData) {
    return (
      <main className="mx-auto w-full max-w-[1800px] space-y-4 p-5 sm:p-6 md:p-10">
        <Link
          href="/classroom/teacher"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Teacher Workspace
        </Link>

        <h1 className="text-2xl font-semibold">Unable to load course</h1>

        <p role="alert" className="text-destructive">
          {error || 'This course could not be found.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-6 pb-8 sm:space-y-8 sm:px-6 md:px-10 lg:px-12">
      {/* Back navigation */}
      <Link
        href="/classroom/teacher"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All courses
      </Link>

      {/* Course overview */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Course heading */}
        <div className="bg-gradient-to-br from-violet-600/20 via-purple-500/10 to-background p-5 sm:p-6 md:p-9">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80 shadow-sm sm:h-12 sm:w-12">
            <GraduationCap className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          </div>

          <p className="mt-4 text-xs font-semibold tracking-wide text-primary sm:mt-5 sm:text-sm">
            COURSE OVERVIEW
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {courseData.course.title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
            {courseData.course.description || 'Explore the modules and lessons in this course.'}
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-background/70 px-3 py-2 text-xs font-medium text-primary">
            <GraduationCap className="h-4 w-4" /> Teacher course manager
          </div>
        </div>

        {/* Course statistics */}
        <div className="grid grid-cols-3 gap-2 border-t border-border p-4 sm:gap-5 sm:p-6">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 sm:h-11 sm:w-11">
              <Layers3 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold sm:text-2xl">{sortedModules.length}</p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {sortedModules.length === 1 ? 'Module' : 'Modules'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 sm:h-11 sm:w-11">
              <BookOpen className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold sm:text-2xl">{totalLessons}</p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {totalLessons === 1 ? 'Lesson' : 'Lessons'}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 sm:h-11 sm:w-11">
              <CheckCircle2 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold sm:text-2xl">{completionPercentage}%</p>
              <p className="text-xs text-muted-foreground sm:text-sm">Completed</p>
            </div>
          </div>
        </div>

        {/* Overall progress */}
      </section>

      {/* Course modules and lessons */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Course content</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Build your course by adding modules and lessons.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowModuleForm((value) => !value);
              setManagementError(null);
              setManagementSuccess(null);
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {showModuleForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showModuleForm ? 'Close' : 'Add module'}
          </button>
        </div>

        {(managementError || managementSuccess) && (
          <div
            role={managementError ? 'alert' : 'status'}
            className={`rounded-lg border px-4 py-3 text-sm ${managementError ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'}`}
          >
            {managementError || managementSuccess}
          </div>
        )}

        {showModuleForm && (
          <form
            onSubmit={handleCreateModule}
            className="space-y-4 rounded-xl border border-primary/20 bg-card p-4 sm:p-5"
          >
            <div>
              <h3 className="font-semibold">Create a module</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Modules organize your course into sections.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">
                Module title
                <input
                  required
                  value={moduleTitle}
                  onChange={(event) => setModuleTitle(event.target.value)}
                  placeholder="e.g. Introduction"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
                <input
                  value={moduleDescription}
                  onChange={(event) => setModuleDescription(event.target.value)}
                  placeholder="What does this module cover?"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingModule || !moduleTitle.trim()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingModule && <Loader2 className="h-4 w-4 animate-spin" />}
                {savingModule ? 'Creating module...' : 'Create module'}
              </button>
            </div>
          </form>
        )}

        {sortedModules.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center sm:p-10">
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
                  {/* Module accordion header */}
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => toggleModule(module.id)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3.5 text-left transition hover:bg-muted/40 sm:gap-4 sm:p-5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary sm:h-11 sm:w-11">
                        {String(index + 1).padStart(2, '0')}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold sm:text-base">{module.title}</h3>

                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                          {moduleLessons.length} {moduleLessons.length === 1 ? 'lesson' : 'lessons'}
                          {moduleLessons.length > 0 && ` · ${moduleCompleted} completed`}
                        </p>

                        {module.description && (
                          <p className="mt-1.5 hidden text-sm text-muted-foreground sm:block">
                            {module.description}
                          </p>
                        )}

                        {moduleLessons.length > 0 && (
                          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted sm:h-1.5">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${modulePercentage}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:h-5 sm:w-5" />
                      )}
                    </button>

                    <div className="flex shrink-0 items-center px-3 sm:px-4">
                      <button
                        type="button"
                        onClick={() => void handleDeleteModule(module)}
                        disabled={deletingModuleId !== null || deletingLessonId !== null}
                        aria-label={`Delete module ${module.title}`}
                        title="Delete module"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingModuleId === module.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Module lessons */}
                  {isOpen && (
                    <div className="border-t border-border">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
                        <span className="text-xs text-muted-foreground">
                          Manage this module&apos;s lessons
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveLessonModuleId(
                              activeLessonModuleId === module.id ? null : module.id
                            );
                            setLessonTitle('');
                            setLessonDescription('');
                            setManagementError(null);
                            setManagementSuccess(null);
                          }}
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/5"
                        >
                          {activeLessonModuleId === module.id ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          {activeLessonModuleId === module.id ? 'Cancel' : 'Add lesson'}
                        </button>
                      </div>

                      {activeLessonModuleId === module.id && (
                        <form
                          onSubmit={(event) => void handleCreateLesson(event, module.slug)}
                          className="space-y-4 border-b border-border bg-card p-4 sm:p-5"
                        >
                          <div>
                            <h4 className="font-semibold">Create a lesson</h4>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Create the lesson first, then build its content using ordered text,
                              image, video, and file blocks.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1.5 text-sm font-medium">
                              Lesson title
                              <input
                                required
                                value={lessonTitle}
                                onChange={(event) => setLessonTitle(event.target.value)}
                                placeholder="e.g. What is engineering?"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </label>
                            <label className="space-y-1.5 text-sm font-medium">
                              Description{' '}
                              <span className="font-normal text-muted-foreground">(optional)</span>
                              <input
                                value={lessonDescription}
                                onChange={(event) => setLessonDescription(event.target.value)}
                                placeholder="A short lesson summary"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </label>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={savingLesson || !lessonTitle.trim()}
                              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {savingLesson && <Loader2 className="h-4 w-4 animate-spin" />}
                              {savingLesson ? 'Creating lesson...' : 'Create lesson'}
                            </button>
                          </div>
                        </form>
                      )}

                      {moduleLessons.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                          No lessons in this module yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {moduleLessons.map((lesson, lessonIndex) => {
                            const isCompleted = completedLessonIds.has(lesson.id);
                            const isDeleting = deletingLessonId === lesson.id;

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
                                  <p className="text-sm font-medium">
                                    <span className="mr-1.5 text-muted-foreground">
                                      {lessonIndex + 1}.
                                    </span>
                                    {lesson.title}
                                  </p>

                                  {lesson.description && (
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                                      {lesson.description}
                                    </p>
                                  )}
                                </div>

                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                              </>
                            );

                            return (
                              <div
                                key={lesson.id}
                                className="flex items-center gap-2 px-4 py-2 sm:px-5"
                              >
                                {lesson.sanityDocumentId ? (
                                  <Link
                                    href={`/classroom/teacher/courses/${courseData.course.slug}/module/${module.slug}/lessons/${lesson.slug}`}
                                    className="group flex min-h-12 min-w-0 flex-1 items-center gap-3 py-1 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                  >
                                    {lessonContent}
                                  </Link>
                                ) : (
                                  <div
                                    className="flex min-h-12 min-w-0 flex-1 cursor-not-allowed items-center gap-3 py-1 opacity-50"
                                    title="Lesson content is not available yet"
                                  >
                                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />

                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium">
                                        <span className="mr-1.5 text-muted-foreground">
                                          {lessonIndex + 1}.
                                        </span>
                                        {lesson.title}
                                      </p>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        Content unavailable
                                      </p>
                                    </div>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => void handleDeleteLesson(lesson)}
                                  disabled={deletingLessonId !== null}
                                  aria-label={`Delete lesson ${lesson.title}`}
                                  title="Delete lesson"
                                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
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

      {/* Bottom navigation link */}
      <div className="flex justify-start border-t border-border pt-5">
        <Link
          href="/classroom/teacher"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all courses
        </Link>
      </div>
    </main>
  );
}
