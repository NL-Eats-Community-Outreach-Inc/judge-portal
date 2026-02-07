import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { createAdminClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users, organizationMembers, teamMembers, teams, events } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

export async function DELETE(
  request: NextRequest,
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

    // Multi-org aware deletion for judges
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

      if (memberships.length > 1) {
        // Judge belongs to multiple orgs — only remove from THIS org
        await db
          .delete(organizationMembers)
          .where(
            and(
              eq(organizationMembers.userId, userId),
              eq(organizationMembers.organizationId, orgId)
            )
          );

        return NextResponse.json({
          success: true,
          action: 'removed_from_org',
          message: 'Judge removed from your organization',
        });
      }

      // Single org — delete membership then fall through to full deletion
      await db
        .delete(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, orgId)
          )
        );
    }

    // Verify participant is connected to this org's events (via teams)
    if (targetUser.role === 'participant') {
      const participantInOrg = await db
        .selectDistinct({ participantId: teamMembers.participantId })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .innerJoin(events, eq(events.id, teams.eventId))
        .where(
          and(eq(teamMembers.participantId, userId), eq(events.organizationId, orgId))
        )
        .limit(1);

      if (participantInOrg.length === 0) {
        return NextResponse.json(
          { error: 'This participant is not associated with your organization' },
          { status: 403 }
        );
      }
    }

    // Full deletion — delete from users table (CASCADE deletes scores, etc.)
    const [deletedUser] = await db.delete(users).where(eq(users.id, userId)).returning();

    if (!deletedUser) {
      return NextResponse.json({ error: 'Failed to delete user from database' }, { status: 500 });
    }

    // Then delete from Supabase Auth
    const supabase = await createAdminClient();
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting user from auth:', authError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
