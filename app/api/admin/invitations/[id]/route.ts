import { NextRequest, NextResponse } from 'next/server';
import { authServer, revokeInvitation } from '@/lib/auth';
import { db } from '@/lib/db';
import { invitations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError } from '@/lib/utils/api-errors';

/**
 * PATCH /api/admin/invitations/[id]
 * Revoke an invitation
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Verify admin role
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const { id } = await params;

    if (!id) {
      return sendApiError(400, 'BAD_REQUEST', 'Invitation ID is required');
    }

    // Verify invitation belongs to org
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);

    if (!invitation) {
      return sendApiError(404, 'NOT_FOUND', 'Invitation not found');
    }

    if (invitation.organizationId !== orgId) {
      return sendApiError(403, 'FORBIDDEN', 'Invitation does not belong to your organization');
    }

    // Revoke invitation
    await revokeInvitation(id);

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error: unknown) {
    console.error('Revoke invitation error:', error);

    if (error instanceof Error && error.message?.includes('role required')) {
      return sendApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

/**
 * DELETE /api/admin/invitations/[id]
 * Delete an invitation (alternative to revoke)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin role
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const { id } = await params;

    if (!id) {
      return sendApiError(400, 'BAD_REQUEST', 'Invitation ID is required');
    }

    // Verify invitation belongs to org
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);

    if (!invitation) {
      return sendApiError(404, 'NOT_FOUND', 'Invitation not found');
    }

    if (invitation.organizationId !== orgId) {
      return sendApiError(403, 'FORBIDDEN', 'Invitation does not belong to your organization');
    }

    // Delete invitation
    await db.delete(invitations).where(eq(invitations.id, id));

    return NextResponse.json({
      success: true,
      message: 'Invitation deleted successfully',
    });
  } catch (error: unknown) {
    console.error('Delete invitation error:', error);

    if (error instanceof Error && error.message?.includes('role required')) {
      return sendApiError(403, 'FORBIDDEN', 'Admin access required');
    }

    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
