import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { learnworldsSyncRuns } from '@/lib/db/schema';
import { getUserFromSession } from '@/lib/auth/server';
import { runLearnworldsTransform } from '@/lib/learnworlds/transform';

interface TransformRequestBody {
  syncRunId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as TransformRequestBody;

    if (!body.syncRunId) {
      return NextResponse.json(
        { error: 'syncRunId is required in the request body' },
        { status: 400 }
      );
    }

    const [syncRun] = await db
      .select({ id: learnworldsSyncRuns.id })
      .from(learnworldsSyncRuns)
      .where(eq(learnworldsSyncRuns.id, body.syncRunId));

    if (!syncRun) {
      return NextResponse.json(
        { error: `Sync run '${body.syncRunId}' not found` },
        { status: 404 }
      );
    }

    const result = await runLearnworldsTransform(body.syncRunId);

    return NextResponse.json({
      status: 'ok',
      syncRunId: result.syncRunId,
      processedRecords: result.processedRecords,
      persistedRecords: result.persistedRecords,
      skippedRecords: result.skippedRecords,
    });
  } catch (error) {
    console.error('LearnWorlds transform error:', error);
    return NextResponse.json({ error: 'Internal server error during transform' }, { status: 500 });
  }
}
