import { NextRequest, NextResponse } from 'next/server';

import { authServer } from '@/lib/auth';
import { mux } from '@/lib/mux/client';
import { handleRouteError } from '@/lib/utils/api-errors';

// POST /api/teacher/mux/uploads
export async function POST(request: NextRequest) {
  try {
    await authServer.requireTeacher();

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';

    // Create a direct upload URL for the browser.
    const upload = await mux.video.uploads.create({
      cors_origin: request.nextUrl.origin,
      timeout: 86400,
      new_asset_settings: {
        playback_policies: ['signed'],
        video_quality: 'basic',
        ...(title ? { meta: { title } } : {}),
      },
    });

    return NextResponse.json(
      {
        uploadId: upload.id,
        uploadUrl: upload.url,
        status: upload.status,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, 'POST /api/teacher/mux/uploads');
  }
}
