'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

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

export default function LearnerPage() {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCourse() {
      try {
        // Get the available courses
        const coursesResponse = await fetch('/api/learner/courses');

        const coursesData = await coursesResponse.json();

        if (!coursesResponse.ok) {
          throw new Error(coursesData.error_message || 'Failed to load courses');
        }

        const courseSummary = coursesData[0];

        if (!courseSummary) {
          throw new Error('No courses available');
        }

        // Get the course, modules, and lessons
        const courseResponse = await fetch(`/api/learner/courses/${courseSummary.id}`);

        const courseData = await courseResponse.json();

        if (!courseResponse.ok) {
          throw new Error(courseData.error_message || 'Failed to load course');
        }

        setCourse(courseData);
      } catch (error) {
        console.error(error);

        setError(error instanceof Error ? error.message : 'Something went wrong');
      }
    }

    loadCourse();
  }, []);

  if (error) {
    return <p>Error: {error}</p>;
  }

  if (!course) {
    return <p>Loading course...</p>;
  }

  return (
    <main>
      <h1>{course.course.title}</h1>

      {course.course.description && <p>{course.course.description}</p>}

      {course.modules.map((module) => {
        const moduleLessons = course.lessons.filter((lesson) => lesson.moduleId === module.id);

        return (
          <section key={module.id}>
            <h2>{module.title}</h2>

            {module.description && <p>{module.description}</p>}

            {moduleLessons.map((lesson) => (
              <div key={lesson.id}>
                {lesson.sanityDocumentId ? (
                  <Link href={`/learner/lessons/${lesson.id}`}>
                    <button>{lesson.title}</button>
                  </Link>
                ) : (
                  <button disabled>{lesson.title} (Content unavailable)</button>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </main>
  );
}
