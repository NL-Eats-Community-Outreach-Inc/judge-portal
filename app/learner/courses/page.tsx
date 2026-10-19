'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, GraduationCap, Layers3, PlayCircle, Search } from 'lucide-react';

type Course = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type Module = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number | null;
  createdAt: string;
};

type Lesson = {
  id: string;
  moduleId: string;
  sanityDocumentId: string | null;
  title: string;
  description: string | null;
  order: number | null;
  createdAt: string;
};

type CourseDetail = {
  course: Course;
  modules: Module[];
  lessons: Lesson[];
};

export default function AllCoursesPage() {
  const [courses, setCourses] = useState<CourseDetail[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/learner/catalog');
        const data: unknown = await response.json();

        if (!response.ok) {
          const message =
            typeof data === 'object' &&
            data !== null &&
            'error_message' in data &&
            typeof data.error_message === 'string'
              ? data.error_message
              : 'Failed to load courses';

          throw new Error(message);
        }

        if (!Array.isArray(data)) {
          throw new Error('Unexpected courses API response format');
        }

        if (!cancelled) {
          setCourses(data as CourseDetail[]);
        }
      } catch (err) {
        console.error('Failed to load all courses:', err);

        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return courses;

    return courses.filter(({ course }) =>
      [course.title, course.description ?? ''].some((value) => value.toLowerCase().includes(query))
    );
  }, [courses, search]);

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-300">
          <GraduationCap className="h-5 w-5" />
          Student Portal
        </div>

        <h1 className="text-3xl font-bold tracking-tight">My Learning</h1>

        <p className="text-muted-foreground">
          Browse all available courses and open any course to explore its modules and lessons.
        </p>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">All courses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? 'Loading courses...'
                : `${filteredCourses.length} ${
                    filteredCourses.length === 1 ? 'course' : 'courses'
                  }${search.trim() ? ' found' : ' available'}`}
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search all courses..."
              aria-label="Search all courses"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-64 animate-pulse rounded-xl border border-border bg-muted/50"
              />
            ))}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive"
          >
            Failed to load courses: {error}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">
              {courses.length === 0 ? 'No courses available' : 'No matching courses'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {courses.length === 0
                ? 'Available courses will appear here when they are added.'
                : 'Try another search term.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredCourses.map(({ course, modules, lessons }, index) => (
              <Link
                key={course.id}
                href={`/learner/courses/${course.id}`}
                className="group flex min-h-64 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition duration-200 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <div
                  className={`relative flex h-28 items-center justify-between overflow-hidden p-5 ${
                    index % 3 === 0
                      ? 'bg-gradient-to-br from-violet-600/25 via-purple-500/10 to-background'
                      : index % 3 === 1
                        ? 'bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-background'
                        : 'bg-gradient-to-br from-indigo-600/20 via-violet-500/10 to-background'
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-background/85 shadow-sm">
                    <BookOpen className="h-6 w-6 text-violet-600 dark:text-violet-300" />
                  </div>

                  <GraduationCap className="h-16 w-16 text-foreground/10 transition-transform duration-200 group-hover:scale-110" />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-semibold leading-snug group-hover:text-violet-600 dark:group-hover:text-violet-300">
                    {course.title}
                  </h3>

                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {course.description || 'Open this course to explore its learning materials.'}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Layers3 className="h-4 w-4" />
                        {modules.length} {modules.length === 1 ? 'module' : 'modules'}
                      </span>

                      <span className="flex items-center gap-1.5">
                        <PlayCircle className="h-4 w-4" />
                        {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
                      </span>
                    </div>

                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-violet-600 dark:group-hover:text-violet-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
