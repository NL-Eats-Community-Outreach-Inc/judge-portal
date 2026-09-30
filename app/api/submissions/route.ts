import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { requireTeamMembership } from '@/lib/auth/participant';
import { db } from '@/lib/db';
import { events, submissionAiScores, submissions, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { SUBMISSIONS_ENABLED } from '@/lib/config';
import { isUniqueOn } from '@/lib/db/errors';

export async function POST(req: Request) {
  try {
    if (!SUBMISSIONS_ENABLED) {
      return sendApiError(404, 'FEATURE_DISABLED', 'Submissions are not enabled');
    }

    const user = await authServer.requireParticipant();

    const { teamId, submissionText } = await req.json();
    const normalizedSubmissionText =
      typeof submissionText === 'string' ? submissionText.trim() : '';

    if (!teamId) {
      return sendApiError(400, 'BAD_REQUEST', 'Team ID is required');
    }

    if (!normalizedSubmissionText) {
      return sendApiError(400, 'MISSING_SUBMISSION_TEXT', 'Missing submission text');
    }

    await requireTeamMembership(teamId, user.id);

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

    // The scoring service is optional and runs outside Vercel; without a URL
    // configured there is nothing to call, so the submit returns immediately.
    const scoringUrl = process.env.AI_SCORING_URL;
    if (!scoringUrl) {
      return NextResponse.json({ success: true });
    }

    try {
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
  } catch (error) {
    if (isUniqueOn(error, 'event', 'team')) {
      return sendApiError(
        400,
        'SUBMISSION_ALREADY_EXISTS',
        'Submission already exists for this team'
      );
    }
    return handleRouteError(error, 'Error saving submission');
  }
}
