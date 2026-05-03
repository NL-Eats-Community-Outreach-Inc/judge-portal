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
import { sendApiError } from '@/lib/utils/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { teamId } = await params;

    const membership = await requireTeamMembership(teamId, user.id);

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
      return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    const submission = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.teamId, teamId), eq(submissions.eventId, team.eventId)))
      .limit(1);

    const hasSubmitted = submission.length > 0;

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
      return sendApiError(403, 'NOT_MEMBER', 'You are not a member of this team');
    }

    console.error('Error fetching team details:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { teamId } = await params;

    await requireTeamMembership(teamId, user.id);
    await requireTeamEventOpen(teamId);

    const { name, description, demoUrl, repoUrl } = await request.json();

    const updateData: Record<string, string | null> = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return sendApiError(400, 'TEAM_NAME_EMPTY', 'Team name cannot be empty');
      }

      updateData.name = name.trim();
    }

    if (description !== undefined) updateData.description = description?.trim() || null;
    if (demoUrl !== undefined) updateData.demoUrl = demoUrl?.trim() || null;
    if (repoUrl !== undefined) updateData.repoUrl = repoUrl?.trim() || null;

    if (Object.keys(updateData).length === 0) {
      return sendApiError(400, 'NO_FIELDS_TO_UPDATE', 'No fields to update');
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
        return sendApiError(403, 'NOT_MEMBER', 'You are not a member of this team');
      }

      if (error.message === 'TEAM_NOT_FOUND') {
        return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
      }

      if (error.message === 'EVENT_NOT_OPEN') {
        return sendApiError(
          400,
          'EVENT_NOT_OPEN',
          'Teams cannot be edited while the event is not in open status'
        );
      }

      if (
        error.message.includes('duplicate key') &&
        error.message.includes('teams_event_id_name_key')
      ) {
        return sendApiError(
          400,
          'DUPLICATE_TEAM_NAME',
          'A team with this name already exists in this event'
        );
      }
    }

    console.error('Error updating team:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const { teamId } = await params;

    await requireTeamCreator(teamId, user.id);
    await requireTeamEventOpen(teamId);

    await db.delete(teams).where(eq(teams.id, teamId));

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_MEMBER') {
        return sendApiError(403, 'NOT_MEMBER', 'You are not a member of this team');
      }

      if (error.message === 'NOT_CREATOR') {
        return sendApiError(403, 'NOT_CREATOR', 'Only the team creator can delete the team');
      }

      if (error.message === 'TEAM_NOT_FOUND') {
        return sendApiError(404, 'TEAM_NOT_FOUND', 'Team not found');
      }

      if (error.message === 'EVENT_NOT_OPEN') {
        return sendApiError(
          400,
          'EVENT_NOT_OPEN',
          'Teams cannot be deleted while the event is not in open status'
        );
      }
    }

    console.error('Error deleting team:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
