'use client';

import { Card } from '@/components/ui/card';
import { CourseCard } from './course-card';
import { api } from '@/lib/learnworlds';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRightIcon } from 'lucide-react';

export function CourseGrid() {
  const [courses, setCourses] = useState<Array<Course>>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Load initial data on mount
  useEffect(() => {
    fetchPage(page);
  }, [page]);

  const fetchPage = async (p: number) => {
    setLoading(true);
    try {
      const data = await api.getCourses(p);
      setCourses((prev) => [...prev, ...data.courses]);
      setHasMore(data.totalPages > p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}

      {/* Skeleton placeholders while fetching */}
      {loading &&
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}

      {/* Load‑more button */}
      {hasMore && !loading && (
        <Card className="p-4 md:p-6 flex items-center justify-center">
          <button
            onClick={loadMore}
            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          >
            Load more courses <ArrowRightIcon className="h-4 w-4" />
          </button>
        </Card>
      )}
    </div>
  );
}

interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
}
