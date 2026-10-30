'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Search,
  ArrowRight,
  GraduationCap,
  Layers3,
  PlayCircle,
  CheckCircle2,
  Clock3,
  Circle,
} from 'lucide-react';
// Lesson metadata used to count lessons and match progress records to a course.
// 1. Define the data structures used by the dashboard and its API responses.
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
type LessonProgress = {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
};
type CourseStatus = 'in-progress' | 'not-started' | 'completed';
type CourseWithProgress = {
  detail: CourseDetail;
  completedLessons: number;
  totalLessons: number;
  status: CourseStatus;
};

/**
 * Learner Dashboard — Student View
 *
 * Displays the learner's courses, completion progress, and catalogue search.
 *
 * This component:
 * 1. Defines the course, module, lesson, and progress data structures.
 * 2. Initializes dashboard data, search, and request state.
 * 3. Loads the course catalogue and learner progress, validating both responses.
 * 4. Derives completed-lesson lookups and each course's progress status.
 * 5. Filters and groups courses by search query and completion status.
 * 6. Calculates the module and lesson counts displayed on course cards.
 * 7. Renders reusable course cards with status and progress indicators.
 * 8. Renders reusable sections for each course status.
 * 9. Handles loading and request-error states.
 * 10. Renders the dashboard, search field, empty states, and course sections.
 *
 * Course data and progress are fetched together when the dashboard mounts.
 */

export default function LearnerPage() {
  // 2. Initialize course data, learner progress, search, and request state.
  const [courses, setCourses] = useState<CourseDetail[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // The cancellation flag prevents state updates after unmount.
  // 3. Fetch the course catalogue and learner progress when the dashboard mounts.
  useEffect(() => {
    let cancelled = false;
    // Keep both requests and their shared error handling in one loader.
    async function loadCourses() {
      try {
        setLoading(true);
        setError(null);
        // The catalogue and progress endpoints are independent, so request them concurrently.
        const [coursesResponse, progressResponse] = await Promise.all([
          fetch('/api/learner/catalog'),
          fetch('/api/learner/progress'),
        ]);

        const [coursesData, progressData] = await Promise.all([
          coursesResponse.json(),
          progressResponse.json(),
        ]);
        // Both requests must succeed before the dashboard can display a complete view.
        if (!coursesResponse.ok) {
          throw new Error(coursesData.error_message || 'Failed to load courses');
        }

        if (!progressResponse.ok) {
          throw new Error(progressData.error_message || 'Failed to load lesson progress');
        }
        // Validate both response shapes before storing them in component state.
        if (!Array.isArray(coursesData)) {
          throw new Error('Unexpected courses API response format');
        }

        if (!Array.isArray(progressData)) {
          throw new Error('Unexpected progress API response format');
        }

        if (!cancelled) {
          setCourses(coursesData as CourseDetail[]);
          setProgress(progressData as LessonProgress[]);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);

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
  // 4. Derive completed lesson IDs and calculate each course's completion status.
  const completedLessonIds = useMemo(
    () => new Set(progress.filter((item) => item.completed).map((item) => item.lessonId)),
    [progress]
  );
  const coursesWithProgress = useMemo<CourseWithProgress[]>(() => {
    return courses.map((detail) => {
      const totalLessons = detail.lessons.length;
      const completedLessons = detail.lessons.filter((lesson) =>
        completedLessonIds.has(lesson.id)
      ).length;
      // Empty courses remain not started rather than being treated as completed.
      let status: CourseStatus = 'not-started';

      if (totalLessons > 0 && completedLessons === totalLessons) {
        status = 'completed';
      } else if (completedLessons > 0) {
        status = 'in-progress';
      }

      return {
        detail,
        completedLessons,
        totalLessons,
        status,
      };
    });
  }, [courses, completedLessonIds]);
  // 5. Apply the search query and group matching courses by progress status.
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return coursesWithProgress;

    return coursesWithProgress.filter(({ detail }) => {
      const { course } = detail;

      return (
        course.title.toLowerCase().includes(query) ||
        course.description?.toLowerCase().includes(query)
      );
    });
  }, [coursesWithProgress, search]);
  const inProgressCourses = filteredCourses.filter((item) => item.status === 'in-progress');
  const notStartedCourses = filteredCourses.filter((item) => item.status === 'not-started');
  const completedCourses = filteredCourses.filter((item) => item.status === 'completed');
  // 6. Return the module and lesson counts displayed on a course card.
  function getCourseStats(courseDetail: CourseDetail) {
    return {
      modules: courseDetail.modules.length,
      lessons: courseDetail.lessons.length,
    };
  }

  /**
   * Render a course card with status, progress, and module/lesson counts.
   * Reuse this helper across the dashboard's status sections.
   */
  // 7. Render a reusable course card with status, progress, and content counts.
  function renderCourseCard(item: CourseWithProgress) {
    const { detail, completedLessons, totalLessons, status } = item;
    const stats = getCourseStats(detail);
    const isCompleted = status === 'completed';
    const percentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    return (
      <Link
        key={detail.course.id}
        href={`/learner/courses/${detail.course.slug}`}
        className={`group grid aspect-square min-w-0 grid-rows-[1fr_1fr] overflow-hidden rounded-xl border transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isCompleted
            ? 'border-border/70 bg-muted/60 hover:border-muted-foreground/40'
            : 'border-border bg-card hover:border-primary/40'
        }`}
      >
        <div
          className={`relative flex min-h-0 items-center justify-between overflow-hidden p-5 sm:p-6 ${
            isCompleted
              ? 'bg-gradient-to-br from-gray-500/20 via-slate-500/10 to-muted'
              : status === 'in-progress'
                ? 'bg-gradient-to-br from-violet-600/25 via-purple-500/10 to-background'
                : 'bg-gradient-to-br from-slate-500/15 via-violet-500/10 to-background'
          }`}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 shadow-sm ${
              isCompleted ? 'bg-muted' : 'bg-background/80'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
            ) : (
              <BookOpen className="h-6 w-6 text-primary" />
            )}
          </div>

          <GraduationCap className="h-16 w-16 text-foreground/10 transition-transform duration-200 group-hover:scale-110" />

          <span
            className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${
              isCompleted
                ? 'bg-muted text-muted-foreground'
                : status === 'in-progress'
                  ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                  : 'bg-background/80 text-muted-foreground'
            }`}
          >
            {isCompleted ? 'Completed' : status === 'in-progress' ? 'In progress' : 'Not started'}
          </span>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden p-5 sm:p-6">
          <h3
            className={`text-lg font-semibold leading-snug ${
              isCompleted ? 'text-muted-foreground' : 'group-hover:text-primary'
            }`}
          >
            {detail.course.title}
          </h3>

          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {detail.course.description || 'Open this course to explore its learning materials.'}
          </p>

          {totalLessons > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {completedLessons} of {totalLessons} lessons completed
                </span>
                <span>{percentage}%</span>
              </div>

              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${detail.course.title} completion`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    isCompleted ? 'bg-muted-foreground/60' : 'bg-violet-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers3 className="h-4 w-4" />
                {stats.modules} {stats.modules === 1 ? 'module' : 'modules'}
              </span>

              <span className="flex items-center gap-1.5">
                <PlayCircle className="h-4 w-4" />
                {stats.lessons} {stats.lessons === 1 ? 'lesson' : 'lessons'}
              </span>
            </div>

            <ArrowRight
              className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${
                isCompleted
                  ? 'text-muted-foreground'
                  : 'text-muted-foreground group-hover:text-primary'
              }`}
            />
          </div>
        </div>
      </Link>
    );
  }

  /**
   * Render a group of courses with the same progress status.
   * Omit empty groups so the dashboard does not show headings without cards.
   */
  // 8. Render a course-status section, omitting it when no courses match.
  function renderSection({
    title,
    description,
    items,
    icon,
    emptyMessage,
  }: {
    title: string;
    description: string;
    items: CourseWithProgress[];
    icon: React.ReactNode;
    emptyMessage: string;
  }) {
    if (items.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
            {icon}
          </div>

          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'course' : 'courses'} · {description}
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map(renderCourseCard)}
          </div>
        )}
      </section>
    );
  }
  // 9. Handle loading and request-error states before rendering the dashboard.
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1600px] p-6 md:p-10">
        <p className="text-muted-foreground">Loading your courses...</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto w-full max-w-[1600px] p-6 md:p-10">
        <h1 className="text-2xl font-semibold">My Learning</h1>
        <p role="alert" className="mt-4 text-destructive">
          Error loading courses: {error}
        </p>
      </main>
    );
  }
  // 10. Render the dashboard header, search, empty states, and grouped course cards.
  return (
    <main className="w-full min-w-0 space-y-10 px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-300">
          <GraduationCap className="h-5 w-5" />
          Student Dashboard
        </div>

        <h1 className="text-3xl font-bold tracking-tight">My Learning</h1>

        <p className="text-muted-foreground">
          Explore your courses and continue your learning journey.
        </p>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Your courses</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {courses.length} {courses.length === 1 ? 'course' : 'courses'} available
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search courses..."
              aria-label="Search courses"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        {/* An empty catalogue differs from a non-empty catalogue with no search matches. */}
        {/* Distinguish an empty catalogue from a search with no matching courses. */}
        {courses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold">No courses yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your available courses will appear here.
            </p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="font-semibold">No matching courses</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try another search term.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Group cards by progress state to help learners resume or discover work. */}
            {renderSection({
              title: 'In progress',
              description: 'Pick up where you left off',
              items: inProgressCourses,
              icon: <Clock3 className="h-5 w-5" />,
              emptyMessage: 'No courses in progress.',
            })}

            {renderSection({
              title: 'Not started',
              description: 'Ready when you are',
              items: notStartedCourses,
              icon: <Circle className="h-5 w-5" />,
              emptyMessage: 'All your courses have been started.',
            })}

            {renderSection({
              title: 'Completed',
              description: 'Look back at what you have achieved',
              items: completedCourses,
              icon: <CheckCircle2 className="h-5 w-5" />,
              emptyMessage: 'No completed courses yet.',
            })}
          </div>
        )}
      </section>
    </main>
  );
}
