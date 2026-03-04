import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { competitions, organizations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);

    // Get org's competitions, ordered by created date (newest first)
    const allCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.organizationId, orgId))
      .orderBy(desc(competitions.createdAt));

    // Get organization name
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    return NextResponse.json({ competitions: allCompetitions, organizationName: org?.name ?? null });
  } catch (error) {
    console.error('Error fetching competitions:', error);
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
    const { name, description, status, maxTeamSize, prize, tags, submissionDeadline, country } =
      await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Competition name is required' }, { status: 400 });
    }

    const competitionStatus = status || 'setup';

    // Create new competition
    const [competition] = await db
      .insert(competitions)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        status: competitionStatus,
        organizationId: orgId,
        maxTeamSize: maxTeamSize ?? null,
        prize: prize ?? null,
        tags: tags ?? null,
        submissionDeadline: submissionDeadline ?? null,
        country: country ?? null,
      })
      .returning();

    return NextResponse.json({ competition });
  } catch (error) {
    console.error('Error creating competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
