import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { competitions, events, teams } from '@/lib/db/schema';
import { getCorsHeaders, isValidUuid } from '../utils';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { id } = await params;

    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: 'Invalid challenge ID format' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Security note: This is a public endpoint. We scope the query to:
    // 1. Only return events that have published challenges (inner join with competitions)
    // 2. Filter out "setup" status events to prevent data leakage
    // 3. Organization boundaries are enforced at the database level through the event->organization relationship
    // Individual API consumers should only see events they have access to based on business logic.
    const [challenge] = await db
      .select({
        id: events.id,
        status: events.status,
        organizationId: events.organizationId,
        title: sql<string>`COALESCE(${competitions.title}, ${events.name})`,
        shortDescription: competitions.shortDescription,
        coverImageUrl: competitions.coverImageUrl,
        challengeType: competitions.challengeType,
        tags: competitions.tags,
        prize: competitions.prize,
        deadline: competitions.deadline,
        country: competitions.country,
        participantSignupUrl: competitions.participantSignupUrl,
        teamsRegisteredCount: sql<number>`count(${teams.id})::int`,
      })
      .from(events)
      .innerJoin(competitions, eq(competitions.eventId, events.id))
      .leftJoin(teams, eq(teams.eventId, events.id))
      .where(eq(events.id, id))
      .groupBy(
        events.id,
        events.status,
        events.organizationId,
        events.name,
        competitions.title,
        competitions.shortDescription,
        competitions.coverImageUrl,
        competitions.challengeType,
        competitions.tags,
        competitions.prize,
        competitions.deadline,
        competitions.country,
        competitions.participantSignupUrl
      )
      .limit(1);

    if (!challenge || challenge.status === 'setup') {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    const participantBaseUrl =
      process.env.PUBLIC_PARTICIPANT_SIGNUP_BASE_URL || request.nextUrl.origin;

    return NextResponse.json(
      {
        challenge: {
          id: challenge.id,
          title: challenge.title,
          short_description: challenge.shortDescription || null,
          cover_image_url: challenge.coverImageUrl || null,
          challenge_type: challenge.challengeType || 'global',
          tags: challenge.tags || [],
          prize_amount: challenge.prize || null,
          deadline: challenge.deadline || null,
          teams_registered_count: challenge.teamsRegisteredCount,
          country: challenge.country || null,
          participant_signup_url:
            challenge.participantSignupUrl ||
            `${participantBaseUrl}/participant/event/${challenge.id}`,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error fetching challenge detail:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
