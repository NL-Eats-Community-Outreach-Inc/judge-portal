import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, events, teamMembers, users } from '@/lib/db/schema';
import { eq, max, inArray } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { generateJoinCode } from '@/lib/utils/join-code';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { eventId, name, description, demoUrl, repoUrl, awardType } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Verify event exists and belongs to org
    await requireEventInOrg(eventId, orgId);
    const event = await db.select().from(events).where(eq(events.id, eventId)).limit(1);

    if (event.length === 0) {
      return NextResponse.json({ error: 'Event not found' }, { status: 400 });
    }

    // Get the next presentation order by finding the max existing order
    const maxOrderResult = await db
      .select({ maxOrder: max(teams.presentationOrder) })
      .from(teams)
      .where(eq(teams.eventId, eventId))
      .limit(1);

    const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    // Create new team with join code
    const joinCode = await generateJoinCode();
    const [team] = await db
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

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error creating team:', error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('teams_event_id_name_key')) {
        return NextResponse.json(
          { error: 'A team with this name already exists' },
          { status: 400 }
        );
      }
      if (error.message.includes('teams_event_id_presentation_order_key')) {
        return NextResponse.json(
          { error: 'A team with this presentation order already exists' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
