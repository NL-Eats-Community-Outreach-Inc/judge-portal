import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeamCreator, requireTeamEventOpen } from '@/lib/auth/participant';
import { generateJoinCode } from '@/lib/utils/join-code';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Verify creator
    await requireTeamCreator(teamId, user.id);

    // Verify event is open
    await requireTeamEventOpen(teamId);

    // Generate new join code
    const joinCode = await generateJoinCode();

    const [updated] = await db
      .update(teams)
      .set({ joinCode })
      .where(eq(teams.id, teamId))
      .returning();

    return NextResponse.json({ joinCode: updated.joinCode });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_MEMBER') {
        return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
      }
      if (error.message === 'NOT_CREATOR') {
        return NextResponse.json(
          { error: 'Only the team creator can regenerate the join code' },
          { status: 403 }
        );
      }
      if (error.message === 'TEAM_NOT_FOUND') {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
      if (error.message === 'EVENT_NOT_OPEN') {
        return NextResponse.json(
          { error: 'Join code cannot be regenerated while the event is not in open status' },
          { status: 400 }
        );
      }
    }
    console.error('Error regenerating join code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
