'use client';

/**
 * Mux Video — Video Playback Component
 *
 * Provides the Mux Player used to stream authenticated learner video lessons.
 *
 * This component:
 * 1. Defines the playback properties required by the Mux player.
 * 2. Renders the Mux player using the supplied playback ID and signed token.
 */

import MuxPlayer from '@mux/mux-player-react';

// 1. Define the properties required to initialize authenticated video playback.
type MuxVideoProps = {
  playbackId: string;
  token: string;
};

export default function MuxVideo({ playbackId, token }: MuxVideoProps) {
  // 2. Render the Mux player with the supplied playback credentials and configuration.
  return (
    <MuxPlayer
      playbackId={playbackId}
      tokens={{ playback: token }}
      autoPlay
      preload="none"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
