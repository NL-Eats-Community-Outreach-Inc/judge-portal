import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeamCreator, requireTeamEventOpen } from '@/lib/auth/participant';
import { generateJoinCode } from '@/lib/utils/join-code';
import { handleRouteError } from '@/lib/utils/api-errors';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await authServer.requireParticipant();

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
    // NOT_MEMBER / NOT_CREATOR / TEAM_NOT_FOUND / EVENT_NOT_OPEN → their codes
    return handleRouteError(error, 'Error regenerating join code');
  }
}
