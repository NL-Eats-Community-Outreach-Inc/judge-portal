import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eventJudges, users } from '@/lib/db/schema';
import { getUserFromSession } from '@/lib/auth/server';
import { getAdminOrgId, requireEventInOrg } from '@/lib/auth/org';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    await requireEventInOrg(eventId, orgId);

    // Get all assigned judges for this event
    const assignedJudges = await db
      .select({
        judgeId: eventJudges.judgeId,
        assignedAt: eventJudges.assignedAt,
        email: users.email,
      })
      .from(eventJudges)
      .innerJoin(users, eq(users.id, eventJudges.judgeId))
      .where(eq(eventJudges.eventId, eventId));

    // Get all judges (for selection) - sorted alphabetically
    const allJudges = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(eq(users.role, 'judge'))
      .orderBy(users.email);

    return NextResponse.json({
      assigned: assignedJudges,
      available: allJudges,
    });
  } catch (error) {
    console.error('Failed to fetch event judges:', error);
    return NextResponse.json({ error: 'Failed to fetch event judges' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const body = await request.json();
    const { eventId, judgeIds } = body;

    if (!eventId || !Array.isArray(judgeIds)) {
      return NextResponse.json({ error: 'Event ID and judge IDs are required' }, { status: 400 });
    }

    // CRITICAL: Verify event belongs to org BEFORE the delete-all-then-reinsert transaction
    await requireEventInOrg(eventId, orgId);

    // Start a transaction
    await db.transaction(async (tx) => {
      // Remove all existing assignments for this event
      await tx.delete(eventJudges).where(eq(eventJudges.eventId, eventId));

      // Add new assignments
      if (judgeIds.length > 0) {
        await tx
          .insert(eventJudges)
          .values(
            judgeIds.map((judgeId) => ({
              eventId,
              judgeId,
            }))
          )
          .onConflictDoNothing();
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update event judges:', error);
    return NextResponse.json({ error: 'Failed to update event judges' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const judgeId = searchParams.get('judgeId');

    if (!eventId || !judgeId) {
      return NextResponse.json({ error: 'Event ID and judge ID are required' }, { status: 400 });
    }

    await requireEventInOrg(eventId, orgId);

    // Remove specific assignment
    await db
      .delete(eventJudges)
      .where(and(eq(eventJudges.eventId, eventId), eq(eventJudges.judgeId, judgeId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove event judge:', error);
    return NextResponse.json({ error: 'Failed to remove event judge' }, { status: 500 });
  }
}
