import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { learnworldsRawPayloads, learnworldsSyncRuns } from '@/lib/db/schema';
import { fetchLearnworldsProgressData } from './client';
import {
  LearnworldsIngestionResult,
  LearnworldsProgressRecord,
  LearnworldsTriggerMode,
} from './types';

function toTimestampOrNull(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toBoundedProgress(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }

  if (rounded > 100) {
    return 100;
  }

  return rounded;
}

function hashRecord(record: LearnworldsProgressRecord): string {
  return createHash('sha256').update(JSON.stringify(record.raw)).digest('hex');
}

interface LearnworldsFailureNotificationPayload {
  syncRunId: string;
  triggerMode: LearnworldsTriggerMode;
  errorMessage: string;
}

function getFailureWebhookUrl(): string | null {
  const value = process.env.LEARNWORLDS_FAILURE_WEBHOOK_URL?.trim();
  if (!value) {
    return null;
  }

  if (!value.startsWith('https://')) {
    console.warn('LEARNWORLDS_FAILURE_WEBHOOK_URL must use HTTPS; skipping notification');
    return null;
  }

  return value;
}

async function notifyFailedIngestion(
  payload: LearnworldsFailureNotificationPayload
): Promise<void> {
  const webhookUrl = getFailureWebhookUrl();
  if (!webhookUrl) {
    return;
  }

  const timeoutMs = Number.parseInt(
    process.env.LEARNWORLDS_FAILURE_NOTIFY_TIMEOUT_MS || '5000',
    10
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isNaN(timeoutMs) ? 5000 : timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: 'learnworlds.ingestion.failed',
        syncRunId: payload.syncRunId,
        triggerMode: payload.triggerMode,
        errorMessage: payload.errorMessage,
        occurredAt: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`LearnWorlds failure notification webhook returned status ${response.status}`);
    }
  } catch (notifyError) {
    console.error('LearnWorlds failure notification failed:', notifyError);
  } finally {
    clearTimeout(timeout);
  }
}

export async function runLearnworldsIngestion(
  triggerMode: LearnworldsTriggerMode = 'manual'
): Promise<LearnworldsIngestionResult> {
  const [syncRun] = await db
    .insert(learnworldsSyncRuns)
    .values({
      triggerMode,
      status: 'running',
      startedAt: new Date().toISOString(),
    })
    .returning({ id: learnworldsSyncRuns.id });

  if (!syncRun?.id) {
    throw new Error('Failed to create LearnWorlds sync run');
  }

  try {
    const fetched = await fetchLearnworldsProgressData();

    if (fetched.records.length > 0) {
      await db.insert(learnworldsRawPayloads).values(
        fetched.records.map((record) => ({
          syncRunId: syncRun.id,
          sourceEndpoint: fetched.endpoint,
          httpStatus: fetched.httpStatus,
          learnerExternalId: record.learnerId,
          courseExternalId: record.courseId,
          moduleExternalId: record.moduleId,
          lessonExternalId: record.lessonId,
          completionStatus: record.completionStatus,
          progressPercentage: toBoundedProgress(record.progressPercentage),
          lastActivityTimestamp: toTimestampOrNull(record.lastActivityTimestamp),
          recordHash: hashRecord(record),
          payload: record.raw,
          receivedAt: new Date().toISOString(),
        }))
      );
    }

    const totalRecords = fetched.rawCount;
    const validRecords = fetched.records.length;
    const invalidRecords = Math.max(0, totalRecords - validRecords);

    await db
      .update(learnworldsSyncRuns)
      .set({
        status: 'succeeded',
        totalRecords,
        validRecords,
        invalidRecords,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(learnworldsSyncRuns.id, syncRun.id));

    return {
      syncRunId: syncRun.id,
      totalRecords,
      validRecords,
      invalidRecords,
    };
  } catch (error) {
    const safeErrorMessage =
      error instanceof Error ? error.message.slice(0, 500) : 'Unknown LearnWorlds ingestion error';

    await db
      .update(learnworldsSyncRuns)
      .set({
        status: 'failed',
        totalRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        errorMessage: safeErrorMessage,
        finishedAt: new Date().toISOString(),
      })
      .where(eq(learnworldsSyncRuns.id, syncRun.id));

    await notifyFailedIngestion({
      syncRunId: syncRun.id,
      triggerMode,
      errorMessage: safeErrorMessage,
    });

    throw error;
  }
}
