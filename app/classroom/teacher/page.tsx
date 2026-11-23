'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GraduationCap,
  Plus,
  X,
  Loader2,
  Trash2,
  BookOpenCheck,
  ArrowRight,
  BookOpen,
  Pencil,
} from 'lucide-react';

type TeacherCourse = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

function TeacherDashboard() {
  const router = useRouter();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/teacher/courses');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error_message || data.message || 'Failed to load courses.');
        }

        const records = Array.isArray(data) ? data : data.courses;
        if (!Array.isArray(records)) {
          throw new Error('Unexpected teacher courses response format.');
        }

        if (!cancelled) setCourses(records as TeacherCourse[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCourses();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateCourse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a course title.');
      return;
    }

    try {
      setIsSaving(true);
      setFormError(null);

      const response = await fetch('/api/teacher/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_message || data.message || 'Failed to create course.');
      }

      const course = data.course ?? data;
      if (!course?.id) {
        throw new Error('The course was created, but the response did not include its id.');
      }

      router.push(`/classroom/teacher/courses/${course.slug}`);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCourse(course: TeacherCourse) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${course.title}"?\n\nThis will permanently delete the course, ALL its modules, ALL its lessons, their Sanity content, and saved learner progress.\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingCourseId(course.id);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/teacher/courses/${encodeURIComponent(course.slug)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error_message || result.message || 'Failed to delete course.');
      }

      setCourses((current) => current.filter((item) => item.id !== course.id));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete course.');
    } finally {
      setDeletingCourseId(null);
    }
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] space-y-8 px-5 py-6 sm:px-8 lg:px-10 xl:px-12">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-300">
            <GraduationCap className="h-5 w-5" />
            Teacher Workspace
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your courses</h1>
          <p className="max-w-2xl text-muted-foreground">
            Create courses, organize learning materials, and manage your classroom content.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsCreating((current) => !current);
            setFormError(null);
          }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          {isCreating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isCreating ? 'Close form' : 'Create course'}
        </button>
      </section>

      {isCreating && (
        <section className="rounded-xl border border-violet-500/30 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Create a course</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with a title and description. You can organize modules and lessons next.
            </p>
          </div>
          <form onSubmit={handleCreateCourse} className="max-w-2xl space-y-4">
            <div className="space-y-2">
              <label htmlFor="teacher-course-title" className="text-sm font-medium">
                Course title
              </label>
              <input
                id="teacher-course-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Introduction to Engineering"
                maxLength={160}
                required
                autoFocus
                className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="teacher-course-description" className="text-sm font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="teacher-course-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What will students learn in this course?"
                rows={3}
                maxLength={2000}
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-violet-500"
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving || !title.trim()}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? 'Creating...' : 'Create course'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setTitle('');
                  setDescription('');
                  setFormError(null);
                }}
                disabled={isSaving}
                className="min-h-10 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {deleteError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {deleteError}
        </div>
      )}

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Course library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading courses...'
                : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} available to manage`}
            </p>
          </div>
          <BookOpenCheck className="h-6 w-6 text-muted-foreground" />
        </div>

        {loading ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Loading your courses...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 p-8 text-center">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-sm font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No courses yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first course to start building your classroom.
            </p>
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <Plus className="h-4 w-4" /> Create your first course
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {courses.map((course) => (
              <div
                key={course.id}
                className="group flex min-h-52 flex-col rounded-xl border border-border bg-card p-5 transition duration-200 hover:border-violet-500/40 hover:shadow-lg"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                    <BookOpen className="h-5 w-5" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                      <Pencil className="h-3 w-3" /> Manage
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleDeleteCourse(course)}
                      disabled={deletingCourseId !== null}
                      aria-label={`Delete course ${course.title}`}
                      title="Delete course"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingCourseId === course.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-violet-600 dark:group-hover:text-violet-300">
                  {course.title}
                </h3>

                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {course.description || 'No course description yet.'}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <Link
                    href={`/classroom/teacher/courses/${course.slug}`}
                    className="inline-flex items-center gap-2 font-medium transition hover:text-violet-600"
                  >
                    Open course manager
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function TeacherPage() {
  return <TeacherDashboard />;
}
