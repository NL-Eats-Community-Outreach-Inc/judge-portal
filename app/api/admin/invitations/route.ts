import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { createBatchInvitations, getExistingInvitation } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, invitations, organizationMembers } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

/**
 * POST /api/admin/invitations
 * Create invitations (batch supported)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin role
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const body = await request.json();
    const { emails, role = 'judge', customMessage, expiresInDays = 7 } = body;

    // Validate role
    const validRoles = ['admin', 'judge', 'participant'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Validation
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'At least one email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email: string) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: 'Invalid email addresses', invalidEmails },
        { status: 400 }
      );
    }

    // Check for existing pending invitations
    const existingInvites: string[] = [];
    for (const email of emails) {
      const existing = await getExistingInvitation(email);
      if (existing) {
        existingInvites.push(email);
      }
    }

    // Check for already registered users
    // For judges: allow re-invite if they're not already in this org
    const alreadyRegistered: Array<{ email: string; role: string }> = [];
    for (const email of emails) {
      const existingUser = await db
        .select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser[0]) {
        // If this is a judge invite and user is already a judge, check org membership
        if (existingUser[0].role === 'judge' && role === 'judge') {
          const existingMembership = await db
            .select()
            .from(organizationMembers)
            .where(
              and(
                eq(organizationMembers.userId, existingUser[0].id),
                eq(organizationMembers.organizationId, orgId)
              )
            )
            .limit(1);

          if (existingMembership[0]) {
            // Already a member of this org
            alreadyRegistered.push({
              email: existingUser[0].email!,
              role: existingUser[0].role! + ' (already in your org)',
            });
          }
          // If NOT in this org, allow re-invite (don't add to alreadyRegistered)
        } else {
          alreadyRegistered.push({
            email: existingUser[0].email!,
            role: existingUser[0].role!,
          });
        }
      }
    }

    // Filter out emails with existing invitations or registered users
    const registeredEmails = alreadyRegistered.map((u) => u.email);
    const newEmails = emails.filter(
      (email: string) => !existingInvites.includes(email) && !registeredEmails.includes(email)
    );

    if (newEmails.length === 0) {
      return NextResponse.json(
        {
          message: 'All emails are already invited or registered',
          existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
          alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
        },
        { status: 200 }
      );
    }

    // Create invitations with org assignment
    const createdInvitations = await createBatchInvitations({
      emails: newEmails,
      role,
      customMessage,
      expiresInDays,
      createdBy: user.id,
      organizationId: orgId,
    });

    // Generate invite links
    const origin = request.nextUrl.origin;
    const invitesWithLinks = createdInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json({
      success: true,
      invitations: invitesWithLinks,
      existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
      alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
    });
  } catch (error: unknown) {
    console.error('Create invitations error:', error);

    if (error instanceof Error && error.message?.includes('role required')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/invitations
 * List invitations for admin's organization
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    // Get org-scoped invitations
    const orgInvitations = await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, orgId))
      .orderBy(desc(invitations.createdAt));

    // Generate invite links
    const origin = request.nextUrl.origin;
    const invitesWithLinks = orgInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      customMessage: invite.customMessage,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json({
      success: true,
      invitations: invitesWithLinks,
    });
  } catch (error: unknown) {
    console.error('List invitations error:', error);

    if (error instanceof Error && error.message?.includes('role required')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
