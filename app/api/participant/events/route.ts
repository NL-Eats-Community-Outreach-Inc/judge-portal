import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { events, organizations, eventParticipants, competitions } from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'participant') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allEvents = await db
      .select({
        id: events.id,
        name: events.name,
        description: events.description,
        status: events.status,
        maxTeamSize: events.maxTeamSize,
        organizationName: organizations.name,
        createdAt: events.createdAt,
        registrationId: eventParticipants.id,
        registeredAt: eventParticipants.registeredAt,
        challengeType: competitions.challengeType,
        tags: competitions.tags,
      })
      .from(events)
      .leftJoin(organizations, eq(events.organizationId, organizations.id))
      .leftJoin(competitions, eq(events.id, competitions.eventId))
      .leftJoin(
        eventParticipants,
        sql`${eventParticipants.eventId} = ${events.id} AND ${eventParticipants.participantId} = ${user.id}`
      )
      .where(inArray(events.status, ['open', 'active']))
      .orderBy(events.createdAt);

    const result = allEvents.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      status: e.status,
      maxTeamSize: e.maxTeamSize,
      organizationName: e.organizationName,
      createdAt: e.createdAt,
      isRegistered: e.registrationId !== null,
      registeredAt: e.registeredAt,
      challengeType: e.challengeType || 'global',
      challengeTags: e.tags || [],
    }));

    return NextResponse.json({ events: result });
  } catch (error) {
    console.error('Error fetching participant events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
