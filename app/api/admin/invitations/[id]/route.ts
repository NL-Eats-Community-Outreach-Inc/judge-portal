import { NextRequest, NextResponse } from 'next/server';
import { authServer, revokeInvitation } from '@/lib/auth';
import { db } from '@/lib/db';
import { invitations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PATCH /api/admin/invitations/[id]
 * Revoke an invitation
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin role
    await authServer.requireAdmin();

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Revoke invitation
    await revokeInvitation(id);

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully',
    });
  } catch (error: any) {
    console.error('Revoke invitation error:', error);

    if (error.message?.includes('role required')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/invitations/[id]
 * Delete an invitation (alternative to revoke)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin role
    await authServer.requireAdmin();

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Delete invitation
    await db
      .delete(invitations)
      .where(eq(invitations.id, id));

    return NextResponse.json({
      success: true,
      message: 'Invitation deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete invitation error:', error);

    if (error.message?.includes('role required')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
