import { NextRequest, NextResponse } from 'next/server';

import { mux } from '@/lib/mux/client';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';

const getSanityAssetId = (muxAssetId: string) => `mux-video-${muxAssetId}`;

/**
 * Synchronizes a Mux asset with its Sanity mux.videoAsset document.
 *
 * Uses the Mux asset ID to create a deterministic Sanity document ID.
 * Repeated webhook deliveries update the existing document.
 */
async function syncMuxAsset(muxAssetId: string) {
  const asset = await mux.video.assets.retrieve(muxAssetId);

  const playbackId =
    asset.playback_ids?.find((playback) => playback.policy === 'signed')?.id ??
    asset.playback_ids?.[0]?.id;

  const documentId = getSanityAssetId(muxAssetId);

  const filename = asset.meta?.title ?? asset.meta?.external_id ?? muxAssetId;

  const fields: Record<string, unknown> = {
    assetId: muxAssetId,
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

  console.info('Sanity Mux asset synchronized:', {
    muxAssetId,
    sanityDocumentId: documentId,
    status: asset.status,
    hasPlaybackId: Boolean(playbackId),
  });

  return documentId;
}

/**
 * Marks a Sanity video asset as deleted without removing the document.
 * Existing lesson references remain intact.
 */
async function markMuxAssetDeleted(muxAssetId: string) {
  const documentId = getSanityAssetId(muxAssetId);

  await sanityWriteClient
    .transaction()
    .createIfNotExists({
      _id: documentId,
      _type: 'mux.videoAsset',
    })
    .patch(documentId, (patch) =>
      patch.set({
        assetId: muxAssetId,
        status: 'deleted',
      })
    )
    .commit();

  console.info('Sanity Mux asset marked deleted:', documentId);
}

// POST /api/teacher/mux/webhooks
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing MUX_WEBHOOK_SECRET');

    return sendApiError(
      500,
      'WEBHOOK_CONFIGURATION_ERROR',
      'Webhook signing secret is not configured'
    );
  }

  // Read the original, unmodified request body.
  const rawBody = await request.text();

  // Verify that this event genuinely came from Mux.
  let event;

  try {
    event = await mux.webhooks.unwrap(rawBody, request.headers, webhookSecret);
  } catch (error) {
    console.error('Mux webhook signature verification failed:', error);

    return sendApiError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature verification failed');
  }

  try {
    const eventType = event.type;
    const eventData = event.data as unknown as Record<string, unknown>;

    switch (eventType) {
      // Direct upload successfully produced a Mux asset.
      case 'video.upload.asset_created': {
        const assetId = eventData.asset_id;

        if (typeof assetId !== 'string' || !assetId) {
          throw new Error('Mux upload event did not contain an asset_id');
        }

        await syncMuxAsset(assetId);
        break;
      }

      // Mux asset was created.
      case 'video.asset.created': {
        const assetId = eventData.id;

        if (typeof assetId !== 'string' || !assetId) {
          throw new Error('Mux asset.created event did not contain an ID');
        }

        await syncMuxAsset(assetId);
        break;
      }

      // Mux finished processing the video.
      case 'video.asset.ready': {
        const assetId = eventData.id;

        if (typeof assetId !== 'string' || !assetId) {
          throw new Error('Mux asset.ready event did not contain an ID');
        }

        await syncMuxAsset(assetId);
        break;
      }

      // Mux video processing failed.
      case 'video.asset.errored': {
        const assetId = eventData.id;

        if (typeof assetId !== 'string' || !assetId) {
          throw new Error('Mux asset.errored event did not contain an ID');
        }

        await syncMuxAsset(assetId);

        console.error('Mux video processing failed:', assetId);
        break;
      }

      // Mux asset was deleted.
      case 'video.asset.deleted': {
        const assetId = eventData.id;

        if (typeof assetId !== 'string' || !assetId) {
          throw new Error('Mux asset.deleted event did not contain an ID');
        }

        await markMuxAssetDeleted(assetId);
        break;
      }

      default: {
        console.info('Unhandled Mux webhook event:', eventType);
      }
    }

    return NextResponse.json({
      received: true,
      eventType,
    });
  } catch (error) {
    // Return a server error so Mux can retry failed synchronization.
    return handleRouteError(error, 'POST /api/teacher/mux/webhooks');
  }
}
