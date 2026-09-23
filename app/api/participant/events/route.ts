import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { events, organizations, eventParticipants } from '@/lib/db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { handleRouteError } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    const user = await authServer.requireParticipant();

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
      })
      .from(events)
      .leftJoin(organizations, eq(events.organizationId, organizations.id))
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
    }));

    return NextResponse.json({ events: result });
  } catch (error) {
    return handleRouteError(error, 'Error fetching participant events');
  }
}
