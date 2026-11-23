import { NextRequest, NextResponse } from 'next/server';

import { authServer } from '@/lib/auth';
import { mux } from '@/lib/mux/client';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError } from '@/lib/utils/api-errors';

type RouteContext = {
  params: Promise<{ uploadId: string }>;
};

// GET /api/teacher/mux/uploads/[uploadId]
// Retrieves the Mux asset created by a completed direct upload and ensures its
// corresponding Sanity mux.videoAsset document exists before it is attached.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    await authServer.requireTeacher();

    const { uploadId } = await params;
    const upload = await mux.video.uploads.retrieve(uploadId);
    const assetId = upload.asset_id;

    if (!assetId) {
      return NextResponse.json({
        status: upload.status,
        assetId: null,
      });
    }

    const asset = await mux.video.assets.retrieve(assetId);
    const playbackId =
      asset.playback_ids?.find((playback) => playback.policy === 'signed')?.id ??
      asset.playback_ids?.[0]?.id;
    const documentId = `mux-video-${assetId}`;
    const filename = asset.meta?.title ?? asset.meta?.external_id ?? assetId;
    const fields: Record<string, unknown> = {
      assetId,
      status: asset.status,
      data: asset,
    };

    if (playbackId) {
      fields.playbackId = playbackId;
    }

    await sanityWriteClient
      .transaction()
      .createIfNotExists({
        _id: documentId,
        _type: 'mux.videoAsset',
      })
      .patch(documentId, (patch) =>
        patch.set(fields).setIfMissing({
          filename,
          thumbTime: 5,
        })
      )
      .commit();

    return NextResponse.json({
      status: upload.status,
      assetId,
      assetStatus: asset.status,
      playbackId: playbackId ?? null,
      sanityDocumentId: documentId,
    });
  } catch (error) {
    return handleRouteError(error, 'GET /api/teacher/mux/uploads/[uploadId]');
  }
}
