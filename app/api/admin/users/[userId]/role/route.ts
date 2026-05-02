import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession, type UserRole } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }

    const adminOrgId = await getAdminOrgId(user.id);
    const { role } = await request.json();

    if (!role || !['admin', 'judge', 'participant'].includes(role)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid role');
    }

    // Block promotion to super_admin
    if (role === 'super_admin') {
      return sendApiError(403, 'FORBIDDEN', 'Cannot promote to super_admin');
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
    console.error('Error updating user role:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
