import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams, events, teamMembers, users } from '@/lib/db/schema';
import { eq, max } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const includeMembers = searchParams.get('includeMembers') === 'true';

    // Build query with conditions
    const allTeams = eventId
      ? await db
          .select({
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
          })
          .from(teams)
          .where(eq(teams.eventId, eventId))
          .orderBy(teams.presentationOrder)
      : await db
          .select({
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
          })
          .from(teams)
          .orderBy(teams.presentationOrder);

    // If members are requested, fetch them for each team
    if (includeMembers) {
      const teamsWithMembers = await Promise.all(
        allTeams.map(async (team) => {
          const members = await db
            .select({
              id: teamMembers.id,
              userId: teamMembers.userId,
              userEmail: users.email,
              joinedAt: teamMembers.joinedAt,
            })
            .from(teamMembers)
            .leftJoin(users, eq(teamMembers.userId, users.id))
            .where(eq(teamMembers.teamId, team.id));

          return {
            ...team,
            members,
            memberCount: members.length,
          };
        })
      );

      return NextResponse.json({ teams: teamsWithMembers });
    }

    return NextResponse.json({ teams: allTeams });
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

    const { eventId, name, description, demoUrl, repoUrl, awardType } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Verify event exists
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

    // Create new team
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
