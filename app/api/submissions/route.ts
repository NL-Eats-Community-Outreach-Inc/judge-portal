import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { submissions, teamMembers, teams } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendApiError } from '@/lib/utils/api-errors';

export async function POST(req: Request) {
  try {
    const user = await getUserFromSession();
    if (!user) {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { teamId, submissionText } = await req.json();

    if (!submissionText) {
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

    const teamRecord = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

    if (teamRecord.length === 0) {
      return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    const eventId = teamRecord[0].eventId;

    const existing = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.teamId, teamId), eq(submissions.eventId, eventId)))
      .limit(1);

    if (existing.length > 0) {
      return sendApiError(
        400,
        'SUBMISSION_ALREADY_EXISTS',
        'Submission already exists for this team'
      );
    }

    // Insert submission
    await db.insert(submissions).values({
      eventId,
      teamId,
      submissionText,
    });

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
