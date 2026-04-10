import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, teams } from '@/lib/db/schema';
import { getCorsHeaders } from './utils';

const VALID_STATUSES = ['open', 'active', 'completed'] as const;
type ChallengeStatus = (typeof VALID_STATUSES)[number];

function resolveStatus(request: NextRequest): {
  status: ChallengeStatus;
  hasInvalidStatusParam: boolean;
} {
  const statusParam = request.nextUrl.searchParams.get('status')?.trim();

  if (!statusParam) {
    return { status: 'open', hasInvalidStatusParam: false };
  }

  if (VALID_STATUSES.includes(statusParam as ChallengeStatus)) {
    return { status: statusParam as ChallengeStatus, hasInvalidStatusParam: false };
  }

  return { status: 'open', hasInvalidStatusParam: true };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function GET(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const searchParams = request.nextUrl.searchParams;
    const { status, hasInvalidStatusParam } = resolveStatus(request);
    if (hasInvalidStatusParam) {
      return NextResponse.json(
        { error: 'Invalid status parameter. Valid values: open, active, completed' },
        { status: 400, headers: corsHeaders }
      );
    }

    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const rawOffset = parseInt(searchParams.get('offset') || '0', 10);

    const limit = Number.isNaN(rawLimit) ? 50 : Math.min(Math.max(rawLimit, 1), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    const challenges = await db
      .select({
        id: events.id,
        title: events.name,
        shortDescription: events.description,
        teamsRegisteredCount: sql<number>`count(${teams.id})::int`,
      })
      .from(events)
      .leftJoin(teams, eq(teams.eventId, events.id))
      .where(eq(events.status, status))
      .groupBy(events.id, events.name, events.description, events.createdAt)
      .orderBy(events.createdAt)
      .limit(limit)
      .offset(offset);

    const participantBaseUrl =
      process.env.PUBLIC_PARTICIPANT_SIGNUP_BASE_URL || request.nextUrl.origin;

    const responsePayload = {
      challenges: challenges.map((challenge) => ({
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
      })),
      pagination: { limit, offset, count: challenges.length },
    };

    return NextResponse.json(responsePayload, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
