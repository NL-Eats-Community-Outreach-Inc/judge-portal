import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, teams } from '@/lib/db/schema';
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

    const [challenge] = await db
    .select({
      id: events.id,
      status: events.status,
      title: events.name,
      shortDescription: events.description,
      teamsRegisteredCount: sql<number>`count(${teams.id})::int`,
  })
  .from(events)
  .leftJoin(teams, eq(teams.eventId, events.id))
  .where(eq(events.id, id))
  .groupBy(events.id, events.status, events.name, events.description)
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
          cover_image_url: null,
          challenge_type: 'global',
          tags: [],
          prize_amount: null,
          deadline: null,
          teams_registered_count: challenge.teamsRegisteredCount,
          country: null,
          participant_signup_url: `${participantBaseUrl}/participant/event/${challenge.id}`,
        }
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
