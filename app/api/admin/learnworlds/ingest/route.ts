import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import {
  LearnworldsAuthError,
  LearnworldsConfigError,
  LearnworldsFetchError,
} from '@/lib/learnworlds/client';
import { runLearnworldsIngestion } from '@/lib/learnworlds/ingestion';
import type { LearnworldsTriggerMode } from '@/lib/learnworlds/types';

interface IngestionRequestBody {
  triggerMode?: LearnworldsTriggerMode;
}

const ALLOWED_TRIGGER_MODES: LearnworldsTriggerMode[] = ['manual', 'scheduled', 'webhook'];

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as IngestionRequestBody;
    const triggerMode = body.triggerMode ?? 'manual';

    if (!ALLOWED_TRIGGER_MODES.includes(triggerMode)) {
      return NextResponse.json({ error: 'Invalid triggerMode value' }, { status: 400 });
    }

    const result = await runLearnworldsIngestion(triggerMode);

    return NextResponse.json({
      status: 'ok',
      syncRunId: result.syncRunId,
      totalRecords: result.totalRecords,
      validRecords: result.validRecords,
      invalidRecords: result.invalidRecords,
    });
  } catch (error) {
    if (error instanceof LearnworldsConfigError) {
      console.error('LearnWorlds configuration error:', error.message);
      return NextResponse.json(
        { error: 'LearnWorlds integration is not configured correctly' },
        { status: 500 }
      );
    }

    if (error instanceof LearnworldsAuthError) {
      console.error('LearnWorlds authentication failure');
      return NextResponse.json(
        { error: 'Failed to authenticate with LearnWorlds' },
        { status: 502 }
      );
    }

    if (error instanceof LearnworldsFetchError) {
      console.error('LearnWorlds fetch failure:', error.message);
      return NextResponse.json({ error: 'Failed to fetch LearnWorlds data' }, { status: 502 });
    }

    console.error('Unexpected LearnWorlds ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
