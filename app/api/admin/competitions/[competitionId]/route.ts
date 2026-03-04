import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { competitions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireCompetitionInOrg } from '@/lib/auth/org';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ competitionId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { competitionId } = await params;
    await requireCompetitionInOrg(competitionId, orgId);

    const { name, description, status, maxTeamSize, prize, tags, submissionDeadline, country } =
      await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Competition name is required' }, { status: 400 });
    }

    // Update the competition
    const [updatedCompetition] = await db
      .update(competitions)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        status: status || 'setup',
        maxTeamSize: maxTeamSize ?? null,
        prize: prize ?? null,
        tags: tags ?? null,
        submissionDeadline: submissionDeadline ?? null,
        country: country ?? null,
      })
      .where(eq(competitions.id, competitionId))
      .returning();

    if (!updatedCompetition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    return NextResponse.json({ competition: updatedCompetition });
  } catch (error) {
    console.error('Error updating competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ competitionId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { competitionId } = await params;
    await requireCompetitionInOrg(competitionId, orgId);

    // Check if competition exists before deletion
    const existingCompetition = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);

    if (!existingCompetition.length) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    // Delete the competition (cascading deletes will handle related data)
    await db.delete(competitions).where(eq(competitions.id, competitionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting competition:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
