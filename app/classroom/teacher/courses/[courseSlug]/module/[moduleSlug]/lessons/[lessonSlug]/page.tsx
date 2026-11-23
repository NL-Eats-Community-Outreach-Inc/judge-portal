import TeacherLessonEditor from '@/app/classroom/teacher/components/lesson-editor/TeacherLessonEditor';

interface TeacherLessonPageProps {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
    lessonSlug: string;
  }>;
}

export default async function TeacherLessonPage({ params }: TeacherLessonPageProps) {
  const { courseSlug, moduleSlug, lessonSlug } = await params;
  return (
    <TeacherLessonEditor courseSlug={courseSlug} moduleSlug={moduleSlug} lessonSlug={lessonSlug} />
  );
}
