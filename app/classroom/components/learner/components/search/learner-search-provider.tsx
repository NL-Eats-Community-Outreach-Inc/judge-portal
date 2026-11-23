'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, X, ArrowRight } from 'lucide-react';
import { LearnerSearchInput } from './learner-search-input';

export type LearnerSearchCourse = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  modules: number;
  lessons: number;
  completedLessons: number;
  totalLessons: number;
  status: 'in-progress' | 'not-started' | 'completed';
};

interface LearnerSearchContextValue {
  query: string;
  setQuery: (value: string) => void;
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  searchCourses: LearnerSearchCourse[];
  setSearchCourses: (courses: LearnerSearchCourse[]) => void;
}

const LearnerSearchContext = createContext<LearnerSearchContextValue | null>(null);

interface LearnerSearchProviderProps {
  children: React.ReactNode;
}

export function LearnerSearchProvider({ children }: LearnerSearchProviderProps) {
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCourses, setSearchCoursesState] = useState<LearnerSearchCourse[]>([]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const setSearchCourses = useCallback((courses: LearnerSearchCourse[]) => {
    setSearchCoursesState(courses);
  }, []);

  // Filter the shared course catalogue using the current query.
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return [];

    return searchCourses.filter((course) => {
      return (
        course.title.toLowerCase().includes(normalizedQuery) ||
        course.description?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [searchCourses, query]);

  // Allow Escape to close the mobile search overlay.
  useEffect(() => {
    if (!isSearchOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeSearch();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, closeSearch]);

  const value = useMemo(
    () => ({
      query,
      setQuery,
      isSearchOpen,
      openSearch,
      closeSearch,
      searchCourses,
      setSearchCourses,
    }),
    [query, isSearchOpen, openSearch, closeSearch, searchCourses, setSearchCourses]
  );

  return (
    <LearnerSearchContext.Provider value={value}>
      {children}

      {/* Mobile search overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-background md:hidden">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="learner-search-title"
            className="flex min-h-full flex-col p-4"
          >
            {/* Search header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 id="learner-search-title" className="text-xl font-semibold">
                  Search
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">Find courses in My Learning.</p>
              </div>

              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search input */}
            <LearnerSearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search courses..."
              className="w-full"
              autoFocus
            />

            {/* Search results */}
            <div className="mt-6 flex-1">
              {!query.trim() ? (
                <div className="py-10 text-center">
                  <BookOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" />

                  <p className="font-medium">Find your next learning opportunity</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Start typing to search available courses.
                  </p>
                </div>
              ) : filteredCourses.length === 0 ? (
                <div className="py-10 text-center">
                  <BookOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground/60" />

                  <p className="font-medium">No matching courses</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Try a different course title or keyword.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Courses
                    </h3>

                    <span className="text-xs text-muted-foreground">
                      {filteredCourses.length} {filteredCourses.length === 1 ? 'result' : 'results'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {filteredCourses.map((course) => {
                      const percentage =
                        course.totalLessons > 0
                          ? Math.round((course.completedLessons / course.totalLessons) * 100)
                          : 0;

                      const statusLabel = {
                        'in-progress': 'In progress',
                        'not-started': 'Not started',
                        completed: 'Completed',
                      }[course.status];

                      return (
                        <Link
                          key={course.id}
                          href={course.href}
                          onClick={closeSearch}
                          className="group block rounded-xl border border-border bg-card p-4 transition hover:border-violet-500/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                              <BookOpen className="h-5 w-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold leading-snug group-hover:text-primary">
                                {course.title}
                              </h4>

                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {course.description ||
                                  'Explore this course and its learning materials.'}
                              </p>

                              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  {course.modules} {course.modules === 1 ? 'module' : 'modules'}
                                </span>

                                <span>
                                  {course.lessons} {course.lessons === 1 ? 'lesson' : 'lessons'}
                                </span>
                              </div>
                            </div>

                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                          </div>

                          <div className="mt-4">
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span
                                className={
                                  course.status === 'completed'
                                    ? 'font-medium text-muted-foreground'
                                    : course.status === 'in-progress'
                                      ? 'font-medium text-violet-600 dark:text-violet-300'
                                      : 'text-muted-foreground'
                                }
                              >
                                {statusLabel}
                              </span>

                              {course.totalLessons > 0 && (
                                <span className="text-muted-foreground">{percentage}%</span>
                              )}
                            </div>

                            {course.totalLessons > 0 && (
                              <div
                                className="h-1.5 overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                                aria-label={`${course.title} completion`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={percentage}
                              >
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    course.status === 'completed'
                                      ? 'bg-muted-foreground/60'
                                      : 'bg-violet-500'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </LearnerSearchContext.Provider>
  );
}

/**
 * Access the shared learner search state and controls.
 */
export function useLearnerSearch() {
  const context = useContext(LearnerSearchContext);

  if (!context) {
    throw new Error('useLearnerSearch must be used within LearnerSearchProvider');
  }

  return context;
}
