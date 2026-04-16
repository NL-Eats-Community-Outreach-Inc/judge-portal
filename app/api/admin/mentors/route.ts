import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { mentorProfiles } from '@/lib/db/schema';
import { eq, desc, type SQL } from 'drizzle-orm';

const VISIBILITY_VALUES = ['pending', 'approved', 'all'] as const;
type VisibilityFilter = (typeof VISIBILITY_VALUES)[number];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

// Mentor profiles are a global resource (not org-scoped), so any admin may
// list and review them.
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const visibility = searchParams.get('visibility');

    if (visibility && !VISIBILITY_VALUES.includes(visibility as VisibilityFilter)) {
      return NextResponse.json(
        {
          error: `Invalid visibility parameter. Expected one of: ${VISIBILITY_VALUES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const limit = parseLimit(searchParams.get('limit'));
    const offset = parseOffset(searchParams.get('offset'));

    const whereClause: SQL | undefined =
      visibility === 'pending'
        ? eq(mentorProfiles.isVisible, false)
        : visibility === 'approved'
          ? eq(mentorProfiles.isVisible, true)
          : undefined;

    const mentors = await db
      .select()
      .from(mentorProfiles)
      .where(whereClause)
      .orderBy(desc(mentorProfiles.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ mentors });
  } catch (error) {
    console.error('Error fetching mentor profiles:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
