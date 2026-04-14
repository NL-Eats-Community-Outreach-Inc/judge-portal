import { createHash, randomUUID } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env');
}

if (process.env.ALLOW_TEST_UTILITIES !== 'true') {
  throw new Error(
    'Set ALLOW_TEST_UTILITIES=true in .env.local to run test utilities. ' +
      'Never set this in production!'
  );
}

// HTTP headers for insert operations (returns representation for verification)
const insertHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

// HTTP headers for delete operations (minimal response for efficiency)
const deleteHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  Prefer: 'return=minimal',
};

// Batch size for inserting raw payloads. Smaller batches reduce memory overhead
// and prevent request timeouts on large test datasets.
const BATCH_SIZE = 100;

/**
 * Checks if the LearnWorlds schema tables are available in the test database.
 * Used to gracefully skip LearnWorlds tests when the schema is not provisioned.
 */
export async function isLearnworldsSchemaAvailable(): Promise<boolean> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/learnworlds_sync_runs?select=id&limit=1`, {
    method: 'GET',
    headers: insertHeaders,
  });

  if (response.ok) {
    return true;
  }

  const body = await response.text();
  return !body.includes('PGRST205');
}

export interface SeedRecord {
  learnerExternalId: string | null;
  courseExternalId: string | null;
  progressPercentage: number | null;
  completionStatus: string | null;
}

export interface SeededSyncRun {
  syncRunId: string;
  rawPayloadIds: string[];
  learnerIds: string[];
}

/**
 * Computes a SHA256 hash of the payload for deduplication and integrity checks.
 */
function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Seeds the database with a test sync run and raw payment records.
 *
 * This function:
 * 1. Creates a sync run record to track the ingestion
 * 2. Inserts raw payload records in batches to ensure scalability
 * 3. Returns metadata (IDs) for later cleanup
 *
 * Batching is used to prevent request timeouts and excessive memory usage
 * when handling large numbers of test records.
 */
export async function seedTestSyncRun(records: SeedRecord[]): Promise<SeededSyncRun> {
  const validCount = records.filter((r) => r.learnerExternalId && r.courseExternalId).length;

  // Step 1: Create the sync run record
  const syncRunRes = await fetch(`${SUPABASE_URL}/rest/v1/learnworlds_sync_runs`, {
    method: 'POST',
    headers: insertHeaders,
    body: JSON.stringify({
      trigger_mode: 'manual',
      status: 'succeeded',
      total_records: records.length,
      valid_records: validCount,
      invalid_records: records.length - validCount,
    }),
  });

  if (!syncRunRes.ok) {
    throw new Error(`[seedTestSyncRun] Failed to create sync run: ${await syncRunRes.text()}`);
  }

  const [syncRun] = (await syncRunRes.json()) as Array<{ id: string }>;
  const syncRunId = syncRun.id;

  // Step 2: Transform seed records into payload rows
  const payloadRows = records.map((record, i) => {
    const raw = {
      learner_id: record.learnerExternalId,
      course_id: record.courseExternalId,
      seed_index: i,
      test_nonce: randomUUID(),
    };
    return {
      sync_run_id: syncRunId,
      source_endpoint: '/test/progress',
      http_status: 200,
      learner_external_id: record.learnerExternalId,
      course_external_id: record.courseExternalId,
      completion_status: record.completionStatus,
      progress_percentage: record.progressPercentage,
      record_hash: hashPayload(raw),
      payload: raw,
    };
  });

  // Step 3: Insert raw payloads in batches for scalability
  const insertedPayloads: Array<{ id: string }> = [];
  for (let i = 0; i < payloadRows.length; i += BATCH_SIZE) {
    const batch = payloadRows.slice(i, i + BATCH_SIZE);
    const payloadsRes = await fetch(`${SUPABASE_URL}/rest/v1/learnworlds_raw_payloads`, {
      method: 'POST',
      headers: insertHeaders,
      body: JSON.stringify(batch),
    });

    if (!payloadsRes.ok) {
      throw new Error(
        `[seedTestSyncRun] Failed to create raw payloads batch ${Math.floor(i / BATCH_SIZE) + 1}: ${await payloadsRes.text()}`
      );
    }

    const batchResults = (await payloadsRes.json()) as Array<{ id: string }>;
    insertedPayloads.push(...batchResults);
  }

  const rawPayloadIds = insertedPayloads.map((p) => p.id);

  const learnerIds = records
    .map((r) => r.learnerExternalId)
    .filter((id): id is string => id !== null);

  return { syncRunId, rawPayloadIds, learnerIds };
}

/**
 * Cleans up test data in reverse foreign key dependency order.
 *
 * Deletion order (FK-aware):
 * 1. learner_progress rows - depends on raw payload IDs via foreign key
 * 2. learnworlds_raw_payloads rows - dependencies cleared
 * 3. learnworlds_sync_runs - no foreign key constraints
 *
 * This order prevents constraint violations during cleanup.
 */
export async function cleanupTestSyncRun(seeded: SeededSyncRun): Promise<void> {
  const { syncRunId, rawPayloadIds, learnerIds } = seeded;

  // 1. Remove any persisted learner_progress rows written by the transform
  // (These have a foreign key reference to learnworlds_raw_payloads)
  if (learnerIds.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/learner_progress?learnworlds_user_id=in.(${learnerIds.join(',')})`,
      { method: 'DELETE', headers: deleteHeaders }
    );
  }

  // 2. Remove the staged raw payload rows
  // (These are referenced by learner_progress, so must be deleted after step 1)
  if (rawPayloadIds.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/learnworlds_raw_payloads?id=in.(${rawPayloadIds.join(',')})`,
      { method: 'DELETE', headers: deleteHeaders }
    );
  }

  // 3. Remove the sync run record
  // (No constraints on this, can be deleted last)
  await fetch(`${SUPABASE_URL}/rest/v1/learnworlds_sync_runs?id=eq.${syncRunId}`, {
    method: 'DELETE',
    headers: deleteHeaders,
  });
}
