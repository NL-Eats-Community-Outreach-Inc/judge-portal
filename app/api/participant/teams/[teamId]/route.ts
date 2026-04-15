import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, teamMembers, events, submissions } from '@/lib/db/schema';
import { eq, count, and } from 'drizzle-orm';
import {
  requireTeamMembership,
  requireTeamCreator,
  requireTeamEventOpen,
} from '@/lib/auth/participant';

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
    const membership = await requireTeamMembership(teamId, user.id);

    // Get team details with event info
    const [team] = await db
      .select({
        id: teams.id,
        name: teams.name,
        description: teams.description,
        demoUrl: teams.demoUrl,
        repoUrl: teams.repoUrl,
        eventId: teams.eventId,
        joinCode: teams.joinCode,
        presentationOrder: teams.presentationOrder,
        awardType: teams.awardType,
        createdAt: teams.createdAt,
        eventName: events.name,
        eventStatus: events.status,
        maxTeamSize: events.maxTeamSize,
      })
      .from(teams)
      .innerJoin(events, eq(teams.eventId, events.id))
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if submission exists for this team + event
    const submission = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.teamId, teamId),
          eq(submissions.eventId, team.eventId)
        )
      )
      .limit(1);

    const hasSubmitted = submission.length > 0;

    // Get member count
    const [countResult] = await db
      .select({ memberCount: count(teamMembers.id) })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    return NextResponse.json({
      team: {
        ...team,
        isCreator: membership.isCreator,
        memberCount: Number(countResult.memberCount),
        hasSubmitted, 
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_MEMBER') {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
    }
    console.error('Error fetching team details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Verify membership (any member can edit)
    await requireTeamMembership(teamId, user.id);

    // Verify event is open
    await requireTeamEventOpen(teamId);

    const { name, description, demoUrl, repoUrl } = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, string | null> = {};
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Team name cannot be empty' }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (demoUrl !== undefined) updateData.demoUrl = demoUrl?.trim() || null;
    if (repoUrl !== undefined) updateData.repoUrl = repoUrl?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(teams)
      .set(updateData)
      .where(eq(teams.id, teamId))
      .returning();

    return NextResponse.json({ team: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_MEMBER') {
        return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
      }
      if (error.message === 'TEAM_NOT_FOUND') {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
      if (error.message === 'EVENT_NOT_OPEN') {
        return NextResponse.json(
          { error: 'Teams cannot be edited while the event is not in open status' },
          { status: 400 }
        );
      }
      if (
        error.message.includes('duplicate key') &&
        error.message.includes('teams_event_id_name_key')
      ) {
        return NextResponse.json(
          { error: 'A team with this name already exists in this event' },
          { status: 400 }
        );
      }
    }
    console.error('Error updating team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    // Delete team (cascade deletes team_members and scores)
    await db.delete(teams).where(eq(teams.id, teamId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_MEMBER') {
        return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 });
      }
      if (error.message === 'NOT_CREATOR') {
        return NextResponse.json(
          { error: 'Only the team creator can delete the team' },
          { status: 403 }
        );
      }
      if (error.message === 'TEAM_NOT_FOUND') {
        return NextResponse.json({ error: 'Team not found' }, { status: 404 });
      }
      if (error.message === 'EVENT_NOT_OPEN') {
        return NextResponse.json(
          { error: 'Teams cannot be deleted while the event is not in open status' },
          { status: 400 }
        );
      }
    }
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
