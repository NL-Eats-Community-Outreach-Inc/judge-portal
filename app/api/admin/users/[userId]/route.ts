import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { createAdminClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import {
  users,
  organizationMembers,
  teamMembers,
  teams,
  events,
  eventJudges,
} from '@/lib/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);
    const { userId } = await params;

    // Check if the user exists and get their role
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deletion of super_admin users
    if (targetUser.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete super admin users' }, { status: 403 });
    }

    // Prevent deletion of admins from other organizations
    if (targetUser.role === 'admin' && targetUser.organizationId !== orgId) {
      return NextResponse.json(
        { error: 'Cannot delete admins from other organizations' },
        { status: 403 }
      );
    }

    // Judge removal: ALWAYS remove from org only, never delete user record
    if (targetUser.role === 'judge') {
      const memberships = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId));

      const isInAdminOrg = memberships.some((m) => m.organizationId === orgId);
      if (!isInAdminOrg) {
        return NextResponse.json(
          { error: 'This judge is not a member of your organization' },
          { status: 403 }
        );
      }

      // Remove org membership
      await db
        .delete(organizationMembers)
        .where(
          and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, orgId))
        );

      // Clean up event_judges using score-existence check:
      // For this org's events, remove event_judges entries where the judge has NO scores
      const orgEvents = await db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.organizationId, orgId));

      if (orgEvents.length > 0) {
        const orgEventIds = orgEvents.map((e) => e.id);

        // Delete event_judges entries where no scores exist for this judge+event
        await db.delete(eventJudges).where(
          and(
            eq(eventJudges.judgeId, userId),
            inArray(eventJudges.eventId, orgEventIds),
            sql`NOT EXISTS (
                SELECT 1 FROM scores
                WHERE scores.judge_id = ${eventJudges.judgeId}
                  AND scores.event_id = ${eventJudges.eventId}
              )`
          )
        );
      }

      return NextResponse.json({
        success: true,
        action: 'removed_from_org',
        message: 'Judge removed from your organization',
      });
    }

    // Verify participant is connected to this org's events (via teams)
    if (targetUser.role === 'participant') {
      const participantInOrg = await db
        .selectDistinct({ participantId: teamMembers.participantId })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .innerJoin(events, eq(events.id, teams.eventId))
        .where(and(eq(teamMembers.participantId, userId), eq(events.organizationId, orgId)))
        .limit(1);

      if (participantInOrg.length === 0) {
        return NextResponse.json(
          { error: 'This participant is not associated with your organization' },
          { status: 403 }
        );
      }
    }

    // Full deletion (admins and participants only — judges handled above)
    // Delete from database FIRST (removes FK reference to auth.users)
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch (dbError) {
      console.error('Failed to delete user from database:', userId, dbError);
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }

    // Then delete from Supabase Auth
    const supabase = createAdminClient();
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('DB deleted but auth delete failed for user:', userId, authError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
