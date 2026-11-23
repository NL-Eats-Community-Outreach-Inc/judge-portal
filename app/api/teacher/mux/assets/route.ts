import { NextRequest, NextResponse } from 'next/server';

import { authServer } from '@/lib/auth';
import { mux } from '@/lib/mux/client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';

// GET /api/teacher/mux/assets?limit=25&cursor=<cursor>
export async function GET(request: NextRequest) {
  try {
    await authServer.requireTeacher();

    const searchParams = request.nextUrl.searchParams;

    const rawLimit = searchParams.get('limit') ?? '25';
    const limit = Number(rawLimit);
    const cursor = searchParams.get('cursor');

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return sendApiError(400, 'INVALID_LIMIT', 'Limit must be an integer between 1 and 100');
    }

    if (cursor !== null && (!cursor.trim() || cursor.length > 2048)) {
      return sendApiError(400, 'INVALID_CURSOR', 'A valid pagination cursor is required');
    }

    // Retrieve one page of assets directly from Mux.
    const response = await mux.video.assets.list({
      limit,
      ...(cursor ? { cursor } : {}),
    });

    // Build library-friendly asset information.
    const assets = await Promise.all(
      response.data.map(async (asset) => {
        const playback =
          asset.playback_ids?.find((item) => item.policy === 'public') ??
          asset.playback_ids?.find((item) => item.policy === 'signed');

        let thumbnailUrl: string | null = null;

        if (playback) {
          const thumbnailPath = `https://image.mux.com/${playback.id}/thumbnail.jpg`;

          if (playback.policy === 'signed') {
            const thumbnailToken = await mux.jwt.signPlaybackId(playback.id, {
              type: 'thumbnail',
              params: {
                time: '5',
                width: '640',
                height: '360',
              },
            });

            thumbnailUrl = `${thumbnailPath}?token=${encodeURIComponent(thumbnailToken)}`;
          } else {
            thumbnailUrl = `${thumbnailPath}?time=5&width=640&height=360`;
          }
        }

        const videoTrack = asset.tracks?.find((track) => track.type === 'video');

        return {
          id: asset.id,
          title: asset.meta?.title ?? asset.meta?.external_id ?? null,
          externalId: asset.meta?.external_id ?? null,
          status: asset.status,
          duration: asset.duration,
          aspectRatio: asset.aspect_ratio,
          resolutionTier: asset.resolution_tier,
          createdAt: asset.created_at,
          progress: asset.progress ?? null,
          video: videoTrack
            ? {
                width: videoTrack.max_width,
                height: videoTrack.max_height,
                frameRate: videoTrack.max_frame_rate,
              }
            : null,
          playbackIds: asset.playback_ids ?? [],
          playbackId: playback?.id ?? null,
          playbackPolicy: playback?.policy ?? null,
          thumbnailUrl,
        };
      })
    );

    return NextResponse.json({
      assets,
      pagination: {
        nextCursor: response.next_cursor ?? null,
        hasMore: Boolean(response.next_cursor),
        limit,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/teacher/mux/assets');
  }
}
