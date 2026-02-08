import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, invitations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error fetching org invitations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;
    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Verify invitation belongs to this org
    const [invite] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId)))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    await db
      .update(invitations)
      .set({ status: 'revoked', updatedAt: new Date().toISOString() })
      .where(eq(invitations.id, invitationId));

    return NextResponse.json({ success: true, message: 'Invitation revoked' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error revoking invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;
    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Verify invitation belongs to this org
    const [invite] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId)))
      .limit(1);

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    await db.delete(invitations).where(eq(invitations.id, invitationId));

    return NextResponse.json({ success: true, message: 'Invitation deleted' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error deleting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
