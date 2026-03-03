import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { events, teams } from '@/lib/db/schema';

const VALID_STATUSES = ['setup', 'open', 'active', 'completed'] as const;
type ChallengeStatus = (typeof VALID_STATUSES)[number];

function resolveStatus(request: NextRequest): ChallengeStatus {
  const status = request.nextUrl.searchParams.get('status')?.trim() as ChallengeStatus | undefined;

  if (!status) {
    return 'open';
  }

  return VALID_STATUSES.includes(status) ? status : 'open';
}

function getCorsHeaders(request: NextRequest): HeadersInit {
  const allowedOrigin = process.env.LEARNWORLDS_ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get('origin');
  const origin =
    allowedOrigin && requestOrigin === allowedOrigin ? allowedOrigin : undefined;

  return {
    'Access-Control-Allow-Origin': origin || '',

    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
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
    const statusParam = request.nextUrl.searchParams.get('status')?.trim();
    const status = resolveStatus(request);

    // Validate that if a status parameter was provided, it's valid
    if (statusParam && !VALID_STATUSES.includes(statusParam as ChallengeStatus)) {
      return NextResponse.json(
        { error: 'Invalid status parameter. Valid values: setup, open, active, completed' },
        { status: 400, headers: corsHeaders }
      );
    }

    const challenges = await db
      .select({
        id: events.id,
        title: events.name,
        shortDescription: events.description,
        teamsRegisteredCount: sql<string>`count(${teams.id})`,
      })
      .from(events)
      .leftJoin(teams, eq(teams.eventId, events.id))
      .where(eq(events.status, status))
      .groupBy(events.id, events.name, events.description)
      .orderBy(events.createdAt);

    const participantBaseUrl =
      process.env.PUBLIC_PARTICIPANT_SIGNUP_BASE_URL || request.nextUrl.origin;

    const responsePayload = {
      challenges: challenges.map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        short_description: challenge.shortDescription,
        cover_image_url: null,
        challenge_type: 'global',
        tags: [],
        prize_amount: null,
        deadline: null,
        teams_registered_count: Number(challenge.teamsRegisteredCount),
        participant_signup_url: `${participantBaseUrl}/participant/event/${challenge.id}`,
      })),
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
