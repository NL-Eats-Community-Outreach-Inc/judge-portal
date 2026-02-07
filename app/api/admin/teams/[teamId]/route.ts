import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { teamId } = await params;

    // Verify team belongs to org
    const [existingTeam] = await db
      .select({ eventId: teams.eventId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    await requireEventInOrg(existingTeam.eventId, orgId);

    const { name, description, demoUrl, repoUrl, presentationOrder, awardType } =
      await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    if (typeof presentationOrder !== 'number') {
      return NextResponse.json({ error: 'Presentation order must be a number' }, { status: 400 });
    }

    // Update team (updatedAt is handled automatically by schema .$onUpdate)
    const [team] = await db
      .update(teams)
      .set({
        name: name.trim(),
        description: description?.trim() || null,
        demoUrl: demoUrl?.trim() || null,
        repoUrl: repoUrl?.trim() || null,
        awardType: awardType || 'both',
        presentationOrder,
      })
      .where(eq(teams.id, teamId))
      .returning();

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error updating team:', error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes('duplicate key')) {
      if (error.message.includes('teams_event_id_name_key')) {
        return NextResponse.json(
          { error: 'A team with this name already exists' },
          { status: 400 }
        );
      }
      if (error.message.includes('teams_event_id_presentation_order_key')) {
        return NextResponse.json(
          { error: 'A team with this presentation order already exists' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { teamId } = await params;

    // Verify team belongs to org
    const [existingTeam] = await db
      .select({ eventId: teams.eventId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);

    if (!existingTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    await requireEventInOrg(existingTeam.eventId, orgId);

    // Delete team (cascade will handle related scores)
    const [deletedTeam] = await db.delete(teams).where(eq(teams.id, teamId)).returning();

    if (!deletedTeam) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
