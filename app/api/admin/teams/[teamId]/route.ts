import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { teamId } = await params;

    // Verify team belongs to org
    const [existingTeam] = await db
      .select({ eventId: teams.eventId, eventStatus: events.status })
      .from(teams)
      .innerJoin(events, eq(events.id, teams.eventId))
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!existingTeam) {
      return sendApiError(404, 'NOT_FOUND', 'Team not found');
    }

    await requireEventInOrg(existingTeam.eventId, orgId);

    // The Teams tab disables editing for completed events; this guard is what
    // protects the final results from a stale tab
    if (existingTeam.eventStatus === 'completed') {
      return sendApiError(400, 'INVALID_STATUS', 'The event is completed');
    }

    const { name, description, demoUrl, repoUrl, presentationOrder, awardType } =
      await request.json();

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Team name is required');
    }

    if (!Number.isInteger(presentationOrder) || presentationOrder < 1) {
      return sendApiError(
        400,
        'BAD_REQUEST',
        'Presentation order must be a whole number of at least 1'
      );
    }

    // Update team (updatedAt is handled automatically by schema .$onUpdate)
    const [team] = await db
      .update(teams)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        demoUrl: demoUrl?.trim() || null,
        repoUrl: repoUrl?.trim() || null,
        awardType: awardType || 'both',
        presentationOrder,
      })
      .where(eq(teams.id, teamId))
      .returning();

    if (!team) {
      return sendApiError(404, 'NOT_FOUND', 'Team not found');
    }

    return NextResponse.json({ team });
  } catch (error) {
    if (isUniqueOn(error, 'event_id', 'name')) {
      return sendApiError(
        400,
        'DUPLICATE_TEAM_NAME',
        'A team with this name already exists in this event'
      );
    }
    if (isUniqueOn(error, 'event_id', 'presentation_order')) {
      return sendApiError(
        400,
        'DUPLICATE_PRESENTATION_ORDER',
        'A team with this presentation order already exists'
      );
    }
    return handleRouteError(error, 'Error updating team');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { teamId } = await params;

    // Verify team belongs to org
    const [existingTeam] = await db
      .select({ eventId: teams.eventId, eventStatus: events.status })
      .from(teams)
      .innerJoin(events, eq(events.id, teams.eventId))
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!existingTeam) {
      return sendApiError(404, 'NOT_FOUND', 'Team not found');
    }

    await requireEventInOrg(existingTeam.eventId, orgId);

    // Deleting a team cascades its scores. The Teams tab disables the control
    // once judging has started; this guard is what protects a live team from a
    // stale tab (set the event back to open first when the removal is wanted)
    if (existingTeam.eventStatus !== 'setup' && existingTeam.eventStatus !== 'open') {
      return sendApiError(
        400,
        'INVALID_STATUS',
        'Teams can only be deleted while the event is in setup or open'
      );
    }

    // Delete team (cascade will handle related scores)
    const [deletedTeam] = await db.delete(teams).where(eq(teams.id, teamId)).returning();

    if (!deletedTeam) {
      return sendApiError(404, 'NOT_FOUND', 'Team not found');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, 'Error deleting team');
  }
}
