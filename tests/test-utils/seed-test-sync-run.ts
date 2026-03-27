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

const insertHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const deleteHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  Prefer: 'return=minimal',
};

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

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function seedTestSyncRun(records: SeedRecord[]): Promise<SeededSyncRun> {
  const validCount = records.filter((r) => r.learnerExternalId && r.courseExternalId).length;

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

  const payloadsRes = await fetch(`${SUPABASE_URL}/rest/v1/learnworlds_raw_payloads`, {
    method: 'POST',
    headers: insertHeaders,
    body: JSON.stringify(payloadRows),
  });

  if (!payloadsRes.ok) {
    throw new Error(
      `[seedTestSyncRun] Failed to create raw payloads: ${await payloadsRes.text()}`
    );
  }

  const insertedPayloads = (await payloadsRes.json()) as Array<{ id: string }>;
  const rawPayloadIds = insertedPayloads.map((p) => p.id);

  const learnerIds = records
    .map((r) => r.learnerExternalId)
    .filter((id): id is string => id !== null);

  return { syncRunId, rawPayloadIds, learnerIds };
}

export async function cleanupTestSyncRun(seeded: SeededSyncRun): Promise<void> {
  const { syncRunId, rawPayloadIds, learnerIds } = seeded;

  // 1. Remove any persisted learner_progress rows written by the transform
  if (learnerIds.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/learner_progress?learner_id=in.(${learnerIds.join(',')})`,
      { method: 'DELETE', headers: deleteHeaders }
    );
  }

  // 2. Remove the staged raw payload rows
  if (rawPayloadIds.length > 0) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/learnworlds_raw_payloads?id=in.(${rawPayloadIds.join(',')})`,
      { method: 'DELETE', headers: deleteHeaders }
    );
  }

  // 3. Remove the sync run record
  await fetch(`${SUPABASE_URL}/rest/v1/learnworlds_sync_runs?id=eq.${syncRunId}`, {
    method: 'DELETE',
    headers: deleteHeaders,
  });
}
