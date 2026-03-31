import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { learnworldsRawPayloads, learnerProgress } from '@/lib/db/schema';

export interface TransformResult {
  syncRunId: string;
  processedRecords: number;
  persistedRecords: number;
  skippedRecords: number;
}

/**
 * Reads all staged raw payloads for the given sync run, validates each row,
 * and upserts valid rows into learner_progress (idempotent on learnerId + courseId).
 *
 * A row is considered invalid — and therefore skipped — when either
 * learnerExternalId or courseExternalId is null.
 */
export async function runLearnworldsTransform(syncRunId: string): Promise<TransformResult> {
  const rawPayloads = await db
    .select()
    .from(learnworldsRawPayloads)
    .where(eq(learnworldsRawPayloads.syncRunId, syncRunId));

  const processedRecords = rawPayloads.length;

  const validPayloads = rawPayloads.filter(
    (p) => p.learnerExternalId !== null && p.courseExternalId !== null
  );
  const skippedRecords = processedRecords - validPayloads.length;

  if (validPayloads.length > 0) {
    await db
      .insert(learnerProgress)
      .values(
        validPayloads.map((p) => ({
          learnerId: p.learnerExternalId!,
          courseId: p.courseExternalId!,
          progressPercentage: p.progressPercentage ?? 0,
          completedModules: 0,
          completionStatus: p.completionStatus ?? 'in_progress',
          lastActivityTimestamp: p.lastActivityTimestamp,
          rawPayloadId: p.id,
          sourceSyncedAt: new Date().toISOString(),
        }))
      )
      .onConflictDoUpdate({
        target: [learnerProgress.learnerId, learnerProgress.courseId],
        set: {
          progressPercentage: sql`EXCLUDED.progress_percentage`,
          completionStatus: sql`EXCLUDED.completion_status`,
          lastActivityTimestamp: sql`EXCLUDED.last_activity_timestamp`,
          rawPayloadId: sql`EXCLUDED.raw_payload_id`,
          sourceSyncedAt: sql`EXCLUDED.source_synced_at`,
        },
      });
  }

  return {
    syncRunId,
    processedRecords,
    persistedRecords: validPayloads.length,
    skippedRecords,
  };
}
