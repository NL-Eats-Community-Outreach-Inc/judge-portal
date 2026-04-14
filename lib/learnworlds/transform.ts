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
 *
 * completedModules is computed as the count of distinct moduleExternalId values
 * for each learner+course combination in this sync run. This value is included
 * in both insert and upsert operations to ensure it reflects the current state.
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
    // Compute completedModules: count distinct modules per learner+course for this sync run
    const moduleCounts = new Map<string, number>();
    validPayloads.forEach((p) => {
      const key = `${p.learnerExternalId}:${p.courseExternalId}`;
      if (p.moduleExternalId) {
        // Use a Set to track distinct modules per key
        if (!moduleCounts.has(key)) {
          moduleCounts.set(key, 0);
        }
        // Re-scan to find all records with this learner+course to get accurate distinct count
        const distinctModules = new Set(
          validPayloads
            .filter(
              (x) =>
                x.learnerExternalId === p.learnerExternalId &&
                x.courseExternalId === p.courseExternalId &&
                x.moduleExternalId
            )
            .map((x) => x.moduleExternalId!)
        );
        moduleCounts.set(key, distinctModules.size);
      }
    });

    await db
      .insert(learnerProgress)
      .values(
        validPayloads.map((p) => {
          const moduleCount = moduleCounts.get(`${p.learnerExternalId}:${p.courseExternalId}`) || 0;
          return {
            learnerId: p.learnerExternalId!,
            courseId: p.courseExternalId!,
            progressPercentage: p.progressPercentage ?? 0,
            completedModules: moduleCount,
            completionStatus: p.completionStatus ?? 'in_progress',
            lastActivityTimestamp: p.lastActivityTimestamp,
            rawPayloadId: p.id,
            sourceSyncedAt: new Date().toISOString(),
          };
        })
      )
      .onConflictDoUpdate({
        target: [learnerProgress.learnerId, learnerProgress.courseId],
        set: {
          progressPercentage: sql`EXCLUDED.progress_percentage`,
          completedModules: sql`EXCLUDED.completed_modules`,
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
