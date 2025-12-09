import { Metadata } from 'next';
import { Suspense } from 'react';
import { CourseGrid } from './components/course-grid';
import { Card } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Knowledge Hub - JudgePortal',
  description:
    'Explore courses, track progress, and build your ideas with JudgePortal\'s Knowledge Hub.',
};

export default async function KnowledgeHubPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 mx-auto">
            <GraduationCap className="h-10 w-10 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Knowledge Hub
            </h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto px-2 md:px-0">
            Your one-stop shop for JudgePortal courses, progress tracking,
            and more.
          </p>
        </header>

        {/* Coming‑soon card */}
        <Card className="p-4 md:p-6 text-center bg-muted/30">
          <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3">
            Stay tuned!
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            Browse courses, track progress, and earn badges as you learn. Features coming soon.
          </p>
        </Card>

        {/* Courses (server‑side data fetch) */}
        <section aria-labelledby="courses-heading" className="space-y-4">
          <h2 id="courses-heading" className="sr-only">
            Courses
          </h2>

          <Suspense
            fallback={
              <div className="grid gap-4 md:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <CourseSkeleton key={i} />
                ))}
              </div>
            }
          >
            <CourseGrid />
          </Suspense>
        </section>

        {/* Footer CTA */}
        <footer className="text-center">
          <p className="text-muted-foreground text-sm md:text-base px-4 md:px-0">
            We&apos;re working hard to bring these features to you. Thank you for your patience!
          </p>
        </footer>
      </div>
    </div>
  );
}

/** Simple skeleton for loading state */
function CourseSkeleton() {
  return (
    <Card className="p-4 md:p-6 animate-pulse">
      <div className="h-6 w-6 bg-muted rounded-md mb-2"></div>
      <div className="h-4 w-48 bg-muted rounded-md mb-1"></div>
      <div className="h-3 w-64 bg-muted rounded-md"></div>
    </Card>
  );
}
