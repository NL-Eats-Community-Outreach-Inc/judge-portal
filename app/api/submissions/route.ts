import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events, submissionAiScores, submissions, teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendApiError } from '@/lib/utils/api-errors';

export async function POST(req: Request) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { teamId, submissionText } = await req.json();
    const normalizedSubmissionText =
      typeof submissionText === 'string' ? submissionText.trim() : '';

    if (!normalizedSubmissionText) {
      return sendApiError(400, 'MISSING_SUBMISSION_TEXT', 'Missing submission text');
    }

    // Verify user is on the team
    const membership = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.participantId, user.id)))
      .limit(1);

    if (membership.length === 0) {
      return sendApiError(403, 'NOT_TEAM_MEMBER', 'Not part of this team');
    }

    const teamRecord = await db
      .select({
        eventId: teams.eventId,
        organizationId: events.organizationId,
        eventStatus: events.status,
      })
      .from(teams)
      .innerJoin(events, eq(teams.eventId, events.id))
      .where(eq(teams.id, teamId))
      .limit(1);

    if (teamRecord.length === 0) {
      return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    const eventId = teamRecord[0].eventId;
    const organizationId = teamRecord[0].organizationId;
    const eventStatus = teamRecord[0].eventStatus;

    if (eventStatus !== 'open') {
      return sendApiError(
        400,
        'EVENT_NOT_OPEN',
        'Submissions are only accepted while the event is open'
      );
    }

    const existing = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(and(eq(submissions.teamId, teamId), eq(submissions.eventId, eventId)))
      .limit(1);

    const [inserted] = await db.transaction(async (tx) => {
      if (existing.length > 0) {
        await tx
          .delete(submissionAiScores)
          .where(eq(submissionAiScores.submissionId, existing[0].id));

        await tx.delete(submissions).where(eq(submissions.id, existing[0].id));
      }

      return tx
        .insert(submissions)
        .values({
          eventId,
          teamId,
          submissionText: normalizedSubmissionText,
        })
        .returning({ id: submissions.id });
    });

    try {
      const scoringUrl = process.env.AI_SCORING_URL ?? 'http://127.0.0.1:8000/score';
      const configuredTimeoutMs = Number(process.env.AI_SCORING_TIMEOUT_MS);
      const scoringTimeoutMs =
        Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
          ? configuredTimeoutMs
          : 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), scoringTimeoutMs);

      const scoringResponse = await fetch(scoringUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          submission_id: inserted.id,
          event_id: eventId,
          org_id: organizationId,
          content: normalizedSubmissionText,
        }),
      }).finally(() => clearTimeout(timeoutId));

      if (!scoringResponse.ok) {
        console.error('AI scoring failed:', {
          submissionId: inserted.id,
          eventId,
          status: scoringResponse.status,
          body: await scoringResponse.text(),
        });
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      console.error('AI scoring failed:', {
        submissionId: inserted.id,
        eventId,
        timedOut: isTimeout,
        error,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(error);

    // Handle duplicate submission (DB constraint safety net)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      return sendApiError(
        400,
        'SUBMISSION_ALREADY_EXISTS',
        'Submission already exists for this team'
      );
    }

    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
