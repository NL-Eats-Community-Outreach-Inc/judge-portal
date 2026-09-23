import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  users,
  organizationMembers,
  events,
  eventParticipants,
  teams,
  teamMembers,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

/**
 * A participant belongs to an organization when they are registered for one
 * of its events or are on a team in one (the same set the admin Users tab lists).
 */
async function participantBelongsToOrg(userId: string, orgId: string) {
  const [registration] = await db
    .select({ participantId: eventParticipants.participantId })
    .from(eventParticipants)
    .innerJoin(events, eq(events.id, eventParticipants.eventId))
    .where(and(eq(eventParticipants.participantId, userId), eq(events.organizationId, orgId)))
    .limit(1);
  if (registration) return true;

  const [membership] = await db
    .select({ participantId: teamMembers.participantId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .innerJoin(events, eq(events.id, teams.eventId))
    .where(and(eq(teamMembers.participantId, userId), eq(events.organizationId, orgId)))
    .limit(1);
  return Boolean(membership);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const user = await authServer.requireAdmin();

    const adminOrgId = await getAdminOrgId(user.id);
    const { role } = await request.json();

    if (!role || !['admin', 'judge', 'participant'].includes(role)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid role');
    }

    // Prevent admin from demoting themselves
    if (userId === user.id && role !== 'admin') {
      return sendApiError(400, 'BAD_REQUEST', 'Cannot change your own admin role');
    }

    // Fetch current user to check current role
    const [currentTargetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!currentTargetUser) {
      return sendApiError(404, 'NOT_FOUND', 'User not found');
    }

    // The target must belong to this admin's organization (same guards as DELETE)
    if (currentTargetUser.role === 'super_admin') {
      return sendApiError(403, 'FORBIDDEN', 'Cannot change the role of a super admin');
    }

    if (currentTargetUser.role === 'admin' && currentTargetUser.organizationId !== adminOrgId) {
      return sendApiError(403, 'FORBIDDEN', 'Cannot change admins from other organizations');
    }

    if (currentTargetUser.role === 'judge') {
      const memberships = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, userId));

      if (!memberships.some((m) => m.organizationId === adminOrgId)) {
        return sendApiError(403, 'FORBIDDEN', 'This judge is not a member of your organization');
      }
    }

    if (
      currentTargetUser.role === 'participant' &&
      !(await participantBelongsToOrg(userId, adminOrgId))
    ) {
      return sendApiError(
        403,
        'FORBIDDEN',
        'This participant is not associated with your organization'
      );
    }

    // Build update data with org assignment logic
    const updateData: { role: UserRole; organizationId?: string | null } = { role };

    // When promoting to admin: assign current admin's org
    if (role === 'admin') {
      updateData.organizationId = adminOrgId;
    }

    // When demoting from admin: remove org assignment
    if (currentTargetUser.role === 'admin' && role !== 'admin') {
      updateData.organizationId = null;
    }

    // When promoting to judge, create org membership
    if (role === 'judge') {
      await db
        .insert(organizationMembers)
        .values({ organizationId: adminOrgId, userId })
        .onConflictDoNothing();
    }

    // When demoting from judge, remove org membership for this org
    if (currentTargetUser.role === 'judge' && role !== 'judge') {
      await db
        .delete(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, userId),
            eq(organizationMembers.organizationId, adminOrgId)
          )
        );
    }

    // Update user role
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return sendApiError(404, 'NOT_FOUND', 'User not found');
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    return handleRouteError(error, 'Error updating user role');
  }
}
