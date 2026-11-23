'use client';

import MuxPlayer from '@mux/mux-player-react';

type MuxVideoProps = {
  playbackId: string;
  token: string;
};

export default function MuxVideo({ playbackId, token }: MuxVideoProps) {
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
