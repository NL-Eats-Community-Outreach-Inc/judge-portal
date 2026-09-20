import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireTeamCreator, requireTeamEventOpen } from '@/lib/auth/participant';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

/** The team creator removes another member while the event is open. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string; userId: string }> }
) {
  try {
    const user = await authServer.requireParticipant();

    const { teamId, userId } = await params;

    // Verify creator, then that the event is still open
    await requireTeamCreator(teamId, user.id);
    await requireTeamEventOpen(teamId);

    if (userId === user.id) {
      return sendApiError(400, 'BAD_REQUEST', 'Use leave to remove yourself from the team');
    }

    const [removed] = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.participantId, userId)))
      .returning({ id: teamMembers.id });

    if (!removed) {
      return sendApiError(404, 'NOT_FOUND', 'That participant is not a member of this team');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // NOT_MEMBER / NOT_CREATOR / TEAM_NOT_FOUND / EVENT_NOT_OPEN → their codes
    return handleRouteError(error, 'Error removing team member');
  }
}
