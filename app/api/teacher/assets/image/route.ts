import { NextRequest, NextResponse } from 'next/server';

import { authServer } from '@/lib/auth';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

// POST /api/teacher/assets/image
export async function POST(request: NextRequest) {
  try {
    await authServer.requireTeacher();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return sendApiError(400, 'MISSING_FILE', 'Choose an image to upload.');
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return sendApiError(
        415,
        'UNSUPPORTED_IMAGE_TYPE',
        'Upload a JPG, PNG, WebP, GIF, or AVIF image.'
      );
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
      return sendApiError(413, 'IMAGE_TOO_LARGE', 'Images must be smaller than 20 MB.');
    }

    const asset = await sanityWriteClient.assets.upload(
      'image',
      Buffer.from(await file.arrayBuffer()),
      {
        filename: file.name,
        contentType: file.type,
      }
    );

    return NextResponse.json(
      {
        asset: {
          _id: asset._id,
          _type: asset._type,
          url: asset.url,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          size: asset.size,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, 'POST /api/teacher/assets/image');
  }
}
