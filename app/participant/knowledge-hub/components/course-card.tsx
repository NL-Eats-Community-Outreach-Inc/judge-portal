'use client';

import { Card } from '@/components/ui/card';
import { BookOpenText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
}

export function CourseCard({ course }: { course: Course }) {
  return (
    <Link href={`/courses/${course.id}`} prefetch>
      <Card className="group p-4 md:p-6 cursor-pointer hover:shadow-lg transition-shadow">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={course.title}
            className="w-full h-32 object-cover rounded-md mb-4 group-hover:opacity-90 transition-opacity"
          />
        ) : (
          <div className="w-full h-32 bg-muted rounded-md mb-4 flex items-center justify-center">
            <BookOpenText className="h-10 w-10 text-primary" />
          </div>
        )}
        <h3 className="font-semibold text-foreground text-sm md:text-base mb-2">{course.title}</h3>
        <p className="text-muted-foreground text-xs md:text-sm">{course.description}</p>
      </Card>
    </Link>
  );
}
