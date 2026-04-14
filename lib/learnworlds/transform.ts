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
 * and upserts valid rows into learner_progress (idempotent on
 * learnworldsUserId + courseId).
 *
 * A row is considered invalid — and therefore skipped — when either
 * learnerExternalId or courseExternalId is null.
 *
 * completedModules is computed as the count of distinct moduleExternalId values
 * with completionStatus='completed' for each learner+course combination in this
 * sync run. This value is included in both insert and upsert operations to
 * ensure it reflects the current state.
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
  let persistedRecords = 0;

  if (validPayloads.length > 0) {
    // Count distinct completed modules per learner+course for this sync run.
    const completedModuleSets = new Map<string, Set<string>>();
    const latestByLearnerCourse = new Map<
      string,
      {
        learnworldsUserId: string;
        courseId: string;
        progressPercentage: number;
        completionStatus: string;
        lastActivityTimestamp: string | null;
        rawPayloadId: string;
      }
    >();

    validPayloads.forEach((p) => {
      const key = `${p.learnerExternalId}:${p.courseExternalId}`;

      if (p.moduleExternalId && p.completionStatus === 'completed') {
        const moduleSet = completedModuleSets.get(key) ?? new Set<string>();
        moduleSet.add(p.moduleExternalId);
        completedModuleSets.set(key, moduleSet);
      }

      // Keep the most recently iterated payload as the source of scalar fields
      // for each learner+course pair.
      latestByLearnerCourse.set(key, {
        learnworldsUserId: p.learnerExternalId!,
        courseId: p.courseExternalId!,
        progressPercentage: p.progressPercentage ?? 0,
        completionStatus: p.completionStatus ?? 'in_progress',
        lastActivityTimestamp: p.lastActivityTimestamp,
        rawPayloadId: p.id,
      });
    });

    const sourceSyncedAt = new Date().toISOString();
    const upsertRows = Array.from(latestByLearnerCourse.entries()).map(([key, row]) => ({
      ...row,
      completedModules: completedModuleSets.get(key)?.size ?? 0,
      sourceSyncedAt,
    }));

    persistedRecords = upsertRows.length;

    await db
      .insert(learnerProgress)
      .values(upsertRows)
      .onConflictDoUpdate({
        target: [learnerProgress.learnworldsUserId, learnerProgress.courseId],
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
    persistedRecords,
    skippedRecords,
  };
}
