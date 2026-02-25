import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teamMembers, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeamMembership } from '@/lib/auth/participant';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    if (error instanceof Error && error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
