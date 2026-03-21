import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { competitions, events } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

// GET: List all competitions for the admin's organization
export async function GET() {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    // Get org's competitions, ordered by created date (newest first)
    const results = await db
      .select({
        id: competitions.id,
        eventId: competitions.eventId,
        eventName: events.name,
        eventStatus: events.status,
        title: competitions.title,
        shortDescription: competitions.shortDescription,
        coverImageUrl: competitions.coverImageUrl,
        challengeType: competitions.challengeType,
        tags: competitions.tags,
        prize: competitions.prize,
        deadline: competitions.deadline,
        country: competitions.country,
        participantSignupUrl: competitions.participantSignupUrl,
        createdAt: competitions.createdAt,
      })
      .from(competitions)
      .innerJoin(events, eq(events.id, competitions.eventId))
      .where(eq(events.organizationId, orgId))
      .orderBy(competitions.createdAt);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching competitions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

//POST: Create competition metadata for existing event
export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);
    const body = await request.json();

    const {
      eventId,
      title,
      shortDescription,
      coverImageUrl,
      challengeType,
      tags,
      prize,
      deadline,
      country,
      participantSignupUrl,
    } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    //Verify the event belongs to the admin's org
    const [event] = await db
      .select({ id: eventId })
      .from(events)
      .where(and(eq(events.id, eventId), eq(events.organizationId, orgId)));

    if (!event) {
      return NextResponse.json({ error: 'Event not found in your organization' }, { status: 404 });
    }

    const [competition] = await db
      .insert(competitions)
      .values({
        title: title || null,
        shortDescription: shortDescription || null,
        coverImageUrl: coverImageUrl || null,
        challengeType: challengeType || 'global',
        tags: tags || null,
        prize: prize || null,
        deadline: deadline || null,
        country: country || null,
        participantSignupUrl: participantSignupUrl || null,
      })
      .returning();

    return NextResponse.json(competition, { status: 201 });
  } catch (error) {
    console.error('Error creating competition:', error);
    if ((error as Error).message?.includes('unique')) {
      return NextResponse.json(
        { error: 'This event already has a competition record' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
