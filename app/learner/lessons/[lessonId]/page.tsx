'use client';

import { useEffect, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { PortableText } from '@portabletext/react';
import { apiFetch } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import type { PortableTextBlock } from '@portabletext/types';

type LessonPageProps = {
  params: Promise<{
    lessonId: string;
  }>;
};

type LearnerProgress = {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

type Lesson = {
  lesson: {
    id: string;
    title: string;
    description: string | null;
    sanityDocumentId: string | null;
  };
  content: {
    _id: string;
    title: string;
    content: PortableTextBlock[];
    videoContent: unknown;
  };
};

export default function LessonPage({ params }: LessonPageProps) {
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [video, setVideo] = useState<{
    token: string;
    playbackId: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleLessonComplete = async () => {
    if (!lesson || completing || completed) return;

    try {
      setCompleting(true);

      await apiFetch('/api/learner/progress', {
        method: 'POST',
        body: {
          lessonId: lesson.lesson.id,
        },
      });

      setCompleted(true);
    } catch (error) {
      console.error('Error completing lesson:', error);
    } finally {
      setCompleting(false);
    }
  };

  useEffect(() => {
    const loadLesson = async () => {
      try {
        const { lessonId } = await params;

        const lessonResponse = await fetch(`/api/learner/lessons/${lessonId}`);

        const lessonData = await lessonResponse.json();

        if (!lessonResponse.ok) {
          throw new Error(lessonData.error_message || 'Failed to load lesson');
        }

        setLesson(lessonData);

        const videoResponse = await fetch(`/api/learner/video-token?lessonId=${lessonId}`);

        const videoData = await videoResponse.json();

        if (!videoResponse.ok) {
          throw new Error(videoData.error_message || 'Failed to load video');
        }

        setVideo(videoData);

        const progressResponse = await apiFetch<{
          data: LearnerProgress[];
        }>('/api/learner/progress');

        const progress = progressResponse.data;

        const lessonProgress = progress.find((item) => item.lessonId === lessonData.lesson.id);

        setCompleted(lessonProgress?.completed === true);
      } catch (error) {
        console.error(error);

        setError(error instanceof Error ? error.message : 'Something went wrong');
      }
    };

    loadLesson();
  }, [params]);

  if (error) {
    return <p>Error loading lesson: {error}</p>;
  }

  if (!lesson || !video) {
    return <p>Loading lesson...</p>;
  }

  return (
    <main>
      <h1>{lesson.content.title}</h1>

      {lesson.lesson.description && <p>{lesson.lesson.description}</p>}

      <section>
        <PortableText value={lesson.content.content} />
      </section>

      <MuxPlayer
        playbackId={video.playbackId}
        tokens={{
          playback: video.token,
        }}
      />

      <p>{completed ? 'Lesson completed' : 'Lesson not completed'}</p>

      <button onClick={handleLessonComplete} disabled={completing || completed}>
        {completing ? 'Saving...' : completed ? 'Completed' : 'Complete Lesson'}
      </button>

      <button onClick={() => router.push('/learner')}>Leave Lesson</button>
    </main>
  );
}
