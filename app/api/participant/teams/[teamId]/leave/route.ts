import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, teamMembers, events } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

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

    // Verify team exists and event is open
    const [teamEvent] = await db
      .select({
        teamId: teams.id,
        eventId: events.id,
        eventStatus: events.status,
      })
      .from(teams)
      .innerJoin(events, eq(teams.eventId, events.id))
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!teamEvent) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (teamEvent.eventStatus !== 'open') {
      return NextResponse.json(
        { error: 'Cannot leave a team while the event is not in open status' },
        { status: 400 }
      );
    }

    let teamDeleted = false;

    await db.transaction(async (tx) => {
      // Lock all member rows for this team
      await tx.execute(sql`SELECT id FROM team_members WHERE team_id = ${teamId} FOR UPDATE`);

      // Get all members using Drizzle (rows are locked by the SELECT FOR UPDATE above)
      const allMembers = await tx
        .select({
          id: teamMembers.id,
          participantId: teamMembers.participantId,
          isCreator: teamMembers.isCreator,
          joinedAt: teamMembers.joinedAt,
        })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .orderBy(teamMembers.joinedAt, teamMembers.id);

      // Find the leaving member
      const leavingMember = allMembers.find((m) => m.participantId === user.id);

      if (!leavingMember) {
        throw new Error('NOT_MEMBER');
      }

      // Delete the leaving member
      await tx
        .delete(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.participantId, user.id)));

      // Get remaining members
      const remainingMembers = allMembers.filter((m) => m.participantId !== user.id);

      if (remainingMembers.length === 0) {
        // No members left — delete the team
        await tx.delete(teams).where(eq(teams.id, teamId));
        teamDeleted = true;
      } else if (leavingMember.isCreator) {
        // Transfer creator to earliest-joined member (already sorted by joinedAt, id)
        const nextCreator = remainingMembers[0];
        await tx
          .update(teamMembers)
          .set({ isCreator: true })
          .where(eq(teamMembers.id, nextCreator.id));
      }
    });

    return NextResponse.json({ success: true, teamDeleted });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }
    console.error('Error leaving team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
