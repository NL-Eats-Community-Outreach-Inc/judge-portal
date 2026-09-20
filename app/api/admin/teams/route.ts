import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { teams, events, teamMembers, users } from '@/lib/db/schema';
import { eq, max, inArray, sql } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { generateJoinCode } from '@/lib/utils/join-code';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { isUniqueOn } from '@/lib/db/errors';

export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const teamFields = {
      id: teams.id,
      name: teams.name,
      description: teams.description,
      demoUrl: teams.demoUrl,
      repoUrl: teams.repoUrl,
      presentationOrder: teams.presentationOrder,
      awardType: teams.awardType,
      // shown in the Teams tab so participants can join an admin-created team
      joinCode: teams.joinCode,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      eventId: teams.eventId,
    };

    // Build query with org-scoped conditions
    let allTeams;
    if (eventId) {
      await requireEventInOrg(eventId, orgId);
      allTeams = await db
        .select(teamFields)
        .from(teams)
        .where(eq(teams.eventId, eventId))
        .orderBy(teams.presentationOrder);
    } else {
      allTeams = await db
        .select(teamFields)
        .from(teams)
        .innerJoin(events, eq(teams.eventId, events.id))
        .where(eq(events.organizationId, orgId))
        .orderBy(teams.presentationOrder);
    }

    // Fetch members for all teams
    const teamIds = allTeams.map((t) => t.id);
    const members =
      teamIds.length > 0
        ? await db
            .select({
              teamId: teamMembers.teamId,
              participantId: teamMembers.participantId,
              email: users.email,
              isCreator: teamMembers.isCreator,
              joinedAt: teamMembers.joinedAt,
            })
            .from(teamMembers)
            .innerJoin(users, eq(users.id, teamMembers.participantId))
            .where(inArray(teamMembers.teamId, teamIds))
        : [];

    // Group members by teamId
    const membersByTeam = new Map<string, typeof members>();
    for (const m of members) {
      if (!membersByTeam.has(m.teamId)) membersByTeam.set(m.teamId, []);
      membersByTeam.get(m.teamId)!.push(m);
    }

    const teamsWithMembers = allTeams.map((t) => ({
      ...t,
      members: membersByTeam.get(t.id) || [],
    }));

    return NextResponse.json({ teams: teamsWithMembers });
  } catch (error) {
    return handleRouteError(error, 'Error fetching teams');
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const { eventId, name, description, demoUrl, repoUrl, awardType } = await request.json();

    if (!eventId) {
      return sendApiError(400, 'BAD_REQUEST', 'Event ID is required');
    }

    if (!name || !name.trim()) {
      return sendApiError(400, 'BAD_REQUEST', 'Team name is required');
    }

    // Verify event exists and belongs to org
    await requireEventInOrg(eventId, orgId);
    const [event] = await db
      .select({ status: events.status })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) {
      return sendApiError(400, 'BAD_REQUEST', 'Event not found');
    }

    // The Teams tab disables adding for completed events; this guard is what
    // protects the final results from a stale tab
    if (event.status === 'completed') {
      return sendApiError(400, 'INVALID_STATUS', 'The event is completed');
    }

    const team = await db.transaction(async (tx) => {
      // Lock per event so two admins adding teams at the same time are
      // serialised and never compute the same presentation order.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`);

      // Get the next presentation order by finding the max existing order
      const maxOrderResult = await tx
        .select({ maxOrder: max(teams.presentationOrder) })
        .from(teams)
        .where(eq(teams.eventId, eventId))
        .limit(1);

      const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

      // Create new team with join code
      const joinCode = await generateJoinCode();
      const [created] = await tx
        .insert(teams)
        .values({
          eventId,
          name: name.trim(),
          description: description?.trim() || null,
          demoUrl: demoUrl?.trim() || null,
          repoUrl: repoUrl?.trim() || null,
          awardType: awardType || 'both',
          presentationOrder: nextOrder,
          joinCode,
        })
        .returning();

      return created;
    });

    return NextResponse.json({ team: { ...team, members: [] } }, { status: 201 });
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
        409,
        'CONFLICT',
        'A team with this presentation order already exists. Please try again'
      );
    }
    return handleRouteError(error, 'Error creating team');
  }
}
