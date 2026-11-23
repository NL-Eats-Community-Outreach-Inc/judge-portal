import { NextRequest, NextResponse } from 'next/server';

import { authServer } from '@/lib/auth';
import { sanityWriteClient } from '@/lib/sanity/write-client';
import { handleRouteError, sendApiError } from '@/lib/utils/api-errors';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

// POST /api/teacher/assets/file
export async function POST(request: NextRequest) {
  try {
    await authServer.requireTeacher();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return sendApiError(400, 'MISSING_FILE', 'Choose a file to upload.');
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return sendApiError(413, 'FILE_TOO_LARGE', 'Files must be smaller than 50 MB.');
    }

    const asset = await sanityWriteClient.assets.upload(
      'file',
      Buffer.from(await file.arrayBuffer()),
      {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
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
    return handleRouteError(error, 'POST /api/teacher/assets/file');
  }
}
