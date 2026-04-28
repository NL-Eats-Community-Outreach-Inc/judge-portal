import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { getIngestionHealthStatus } from '@/lib/learnworlds/health';

export async function GET() {
  const timestamp = new Date().toISOString();

  let dbStatus = 'connected';
  let globalStatus = 'healthy';
  let httpStatus = 200;

  try {
    await db.execute(sql`SELECT 1`);
  } catch (error) {
    console.error('Health Check failed to connect to the database:', error);
    dbStatus = 'disconnected';
    globalStatus = 'unavailable';
    httpStatus = 503;
  }

  // LearnWorlds Ingestion Check
  let ingestionStatus = {
    status: 'unknown',
    lastRunAt: null as string | null,
  };

  if (dbStatus === 'connected') {
    try {
      const ingestionReport = await getIngestionHealthStatus();

      ingestionStatus = {
        status: ingestionReport.status,
        lastRunAt: ingestionReport.lastRunAt,
      };

      if (ingestionReport.status === 'failing' || ingestionReport.status === 'stale') {
        globalStatus = 'degraded';
      }
    } catch (error) {
      console.error('Health Check failed to retrieve ingestion subsystem health:', error);
      ingestionStatus.status = 'unknown';
      globalStatus = 'degraded';
    }
  }

  const payload = {
    status: globalStatus,
    database: dbStatus,
    timestamp,
    subsystems: {
      ingestion: ingestionStatus,
    },
  };

  return NextResponse.json(payload, { status: httpStatus });
}
