'use client';

/**
 * Lesson Video Player — Lazy-Loaded Mux Video Component
 *
 * Handles the playback experience for individual learner video lessons.
 *
 * This component:
 * 1. Displays a thumbnail preview before video playback begins.
 * 2. Dynamically imports the Mux video player when requested.
 * 3. Fetches a signed playback token from the learner video-token API.
 * 4. Manages loading and error states during video initialization.
 * 5. Renders the Mux player once the video data has been retrieved.
 */

import { useState } from 'react';
import type { ComponentType } from 'react';
import Image from 'next/image';

// 1. Define the data structures required to display and initialize video playback.
type VideoData = {
  token: string;
  playbackId: string;
};

type PlayerProps = {
  playbackId: string;
  token: string;
};

export default function LessonVideoPlayer({
  lessonId,
  thumbnailUrl,
}: {
  lessonId: string;
  thumbnailUrl: string | null;
}) {
  const [video, setVideo] = useState<VideoData | null>(null);
  const [Player, setPlayer] = useState<ComponentType<PlayerProps> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2. Dynamically load the Mux player and retrieve the playback credentials when requested.
  async function handlePlay() {
    if (loading || video) return;

    setLoading(true);
    setError(null);

    try {
      const [playerModule, response] = await Promise.all([
        import('./MuxVideo'),
        fetch(`/api/learner/video-token?lessonId=${encodeURIComponent(lessonId)}`),
      ]);

      // 3. Retrieve and validate the signed playback token from the video-token API.
      const data: VideoData & { error_message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error_message || 'Failed to load video');
      }

      setPlayer(() => playerModule.default);
      setVideo({
        token: data.token,
        playbackId: data.playbackId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      // 4. Reset loading state and preserve any errors for display.
      setLoading(false);
    }
  }

  // 5. Render the initialized Mux player or the thumbnail preview with playback controls.
  if (video && Player) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <Player playbackId={video.playbackId} token={video.token} />
      </div>
    );
  }

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-950 text-white">
      {thumbnailUrl && (
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 70vw"
          className="object-cover"
          unoptimized
        />
      )}

      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <span className="text-sm font-medium drop-shadow">Video lesson</span>

        <button
          type="button"
          onClick={handlePlay}
          disabled={loading}
          aria-label="Play lesson video"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl text-black shadow-lg transition hover:scale-105 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? '…' : '▶'}
        </button>

        <span className="text-sm drop-shadow">{loading ? 'Preparing video…' : 'Play video'}</span>

        {error && (
          <div className="max-w-md text-sm text-red-200" role="alert">
            <p>{error}</p>
            <button type="button" onClick={handlePlay} className="mt-1 underline">
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
