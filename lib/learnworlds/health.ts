import { db } from '@/lib/db';
import { desc } from 'drizzle-orm';
import { learnworldsSyncRuns } from '@/lib/db/schema';

export type IngestionHealthStatus = 'healthy' | 'stale' | 'failing' | 'unknown';

/**
 * Define health report shape
 */
export interface IngestionHealthReport {
  status: IngestionHealthStatus;
  message: string;
  lastRunAt: string | null;
  errorDetails?: string | null;
}

/**
 * Generate asynchronous function that returns health report, default threshold is 24h
 */
export async function getIngestionHealthStatus(): Promise<IngestionHealthReport> {
  const thresholdHours = Number(process.env.LEARNWORLDS_STALENESS_THRESHOLD_HOURS || '24');
  const thresholdMs = thresholdHours * 60 * 60 * 1000;

  const [lastRun] = await db
    .select()
    .from(learnworldsSyncRuns)
    .orderBy(desc(learnworldsSyncRuns.startedAt))
    .limit(1);

  if (!lastRun) {
    return {
      status: 'unknown',
      message: 'No LearnWorlds ingestion activity found.',
      lastRunAt: null,
    };
  }

  if (lastRun.status === 'failed') {
    return {
      status: 'failing',
      message: `The last ingestion run failed. Ingestion pipeline is failing.`,
      lastRunAt: lastRun.finishedAt || lastRun.startedAt,
      errorDetails: lastRun.errorMessage,
    };
  }

  const timestampToEvaluate = lastRun.finishedAt || lastRun.startedAt;
  const lastRunTime = new Date(timestampToEvaluate).getTime();
  const timeSinceLastRunMs = Date.now() - lastRunTime;

  if (timeSinceLastRunMs > thresholdMs) {
    const hoursStale = Math.round(timeSinceLastRunMs / (60 * 60 * 1000));
    return {
      status: 'stale',
      message: `Data is stale. The last successful ingestion was ${hoursStale} hours ago (Threshold: ${thresholdHours}h).`,
      lastRunAt: timestampToEvaluate,
    };
  }

  return {
    status: 'healthy',
    message: 'Ingestion pipeline is running normally. Data is up to date.',
    lastRunAt: timestampToEvaluate,
  };
}
