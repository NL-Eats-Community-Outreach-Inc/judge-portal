import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teamMembers, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeamMembership } from '@/lib/auth/participant';
import { handleRouteError } from '@/lib/utils/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await authServer.requireParticipant();

    const { teamId } = await params;

    // Verify membership
    await requireTeamMembership(teamId, user.id);

    // Get all team members
    const members = await db
      .select({
        id: teamMembers.id,
        participantId: teamMembers.participantId,
        email: users.email,
        isCreator: teamMembers.isCreator,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.participantId, users.id))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(teamMembers.joinedAt);

    return NextResponse.json({ members });
  } catch (error) {
    return handleRouteError(error, 'Error fetching team members');
  }
}
