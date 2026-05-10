import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, invitations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { sendApiError } from '@/lib/utils/api-errors';

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;

    // Verify org exists
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      return sendApiError(404, 'NOT_FOUND', 'Organization not found');
    }

    const orgInvitations = await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, orgId))
      .orderBy(desc(invitations.createdAt));

    const origin = new URL(request.url).origin;
    const invitesWithLinks = orgInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json({ invitations: invitesWithLinks });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(403, 'FORBIDDEN', 'Unauthorized');
    }
    console.error('Error fetching org invitations:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;
    const { invitationId } = await request.json();

    if (!invitationId) {
      return sendApiError(400, 'BAD_REQUEST', 'Invitation ID is required');
    }

    // Verify invitation belongs to this org
    const [invite] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId)))
      .limit(1);

    if (!invite) {
      return sendApiError(404, 'NOT_FOUND', 'Invitation not found');
    }

    await db
      .update(invitations)
      .set({ status: 'revoked', updatedAt: new Date().toISOString() })
      .where(eq(invitations.id, invitationId));

    return NextResponse.json({ success: true, message: 'Invitation revoked' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(403, 'FORBIDDEN', 'Unauthorized');
    }
    console.error('Error revoking invitation:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;
    const { invitationId } = await request.json();

    if (!invitationId) {
      return sendApiError(400, 'BAD_REQUEST', 'Invitation ID is required');
    }

    // Verify invitation belongs to this org
    const [invite] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId)))
      .limit(1);

    if (!invite) {
      return sendApiError(404, 'NOT_FOUND', 'Invitation not found');
    }

    await db.delete(invitations).where(eq(invitations.id, invitationId));

    return NextResponse.json({ success: true, message: 'Invitation deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(401, 'UNAUTHORIZED', 'Unauthorized');
    }
    console.error('Error deleting invitation:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
