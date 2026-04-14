import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { learnworldsSyncRuns } from '@/lib/db/schema';
import { getUserFromSession } from '@/lib/auth/server';
import { runLearnworldsTransform } from '@/lib/learnworlds/transform';

interface TransformRequestBody {
  syncRunId?: string;
}

/**
 * Determines if an error indicates that the LearnWorlds schema tables are not available.
 * This is used to provide graceful handling in test environments where the LearnWorlds
 * schema may not exist or may be mocked.
 *
 * Checks for PostgreSQL error code 42P01 (undefined table) and common LearnWorlds table names
 * in the error message.
 */
function isLearnworldsSchemaUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorWithCode = error as Error & {
    code?: string;
    cause?: { code?: string; message?: string };
  };
  const message = [error.message, errorWithCode.cause?.message].filter(Boolean).join(' ');

  return (
    errorWithCode.code === '42P01' ||
    errorWithCode.cause?.code === '42P01' ||
    (message.includes('learnworlds_') && message.includes('does not exist')) ||
    (message.includes('learner_progress') && message.includes('does not exist'))
  );
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
    if (isLearnworldsSchemaUnavailableError(error)) {
      return NextResponse.json(
        { error: 'LearnWorlds sync schema is unavailable in this environment' },
        { status: 503 }
      );
    }

    console.error('LearnWorlds transform error:', error);
    return NextResponse.json({ error: 'Internal server error during transform' }, { status: 500 });
  }
}
