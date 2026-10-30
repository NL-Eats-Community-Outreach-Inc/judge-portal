import { NextRequest, NextResponse } from 'next/server';
import { authServer, createBatchInvitations, getExistingInvitation } from '@/lib/auth';
import { db } from '@/lib/db';
import { invitations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

const VALID_ROLES = ['admin', 'judge', 'participant', 'learner'] as const;

type InvitationRole = (typeof VALID_ROLES)[number];

/**
 * POST /api/admin/invitations
 *
 * 1. Authenticate the administrator and resolve their organization.
 * 2. Validate the requested emails and invitation roles.
 * 3. Exclude emails that already have pending invitations.
 * 4. Create invitations containing all requested roles.
 * 5. Return invitation links and existing-invitation information.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const body = await request.json();

    const { emails, customMessage, expiresInDays = 7 } = body;

    // Support the old single-role property temporarily for compatibility.
    const requestedRoles: unknown = Array.isArray(body.roles)
      ? body.roles
      : body.role
        ? [body.role]
        : ['judge'];

    if (
      !Array.isArray(requestedRoles) ||
      requestedRoles.length === 0 ||
      !requestedRoles.every(
        (role: unknown) => typeof role === 'string' && VALID_ROLES.includes(role as InvitationRole)
      )
    ) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid or missing invitation roles');
    }

    const roles = [...new Set(requestedRoles as InvitationRole[])];

    if (!Array.isArray(emails) || emails.length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'At least one email is required');
    }

    if (!emails.every((email: unknown) => typeof email === 'string')) {
      return sendApiError(400, 'BAD_REQUEST', 'Email addresses must be strings');
    }

    const normalizedEmails = [
      ...new Set(emails.map((email: string) => email.trim().toLowerCase())),
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = normalizedEmails.filter((email) => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid email addresses');
    }

    // Check for existing pending invitations.
    const existingInvites: string[] = [];

    for (const email of normalizedEmails) {
      const existing = await getExistingInvitation(email, orgId);

      if (existing) {
        existingInvites.push(email);
      }
    }

    const existingInviteSet = new Set(existingInvites);

    const newEmails = normalizedEmails.filter((email) => !existingInviteSet.has(email));

    if (newEmails.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'All email addresses already have pending invitations.',
          invitations: [],
          existingInvites,
        },
        { status: 200 }
      );
    }

    // Create invitations with every requested role.
    const createdInvitations = await createBatchInvitations({
      emails: newEmails,
      roles,
      customMessage,
      expiresInDays,
      createdBy: user.id,
      organizationId: orgId,
    });

    // Generate invitation links.
    const origin = request.nextUrl.origin;

    const invitesWithLinks = createdInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      roles: invite.roles,
      status: invite.status,
      expiresAt: invite.expiresAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json(
      {
        success: true,
        invitations: invitesWithLinks,
        existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, 'Create invitations error');
  }
}

/**
 * GET /api/admin/invitations
 *
 * 1. Authenticate the administrator and resolve their organization.
 * 2. Retrieve invitations belonging to that organization.
 * 3. Generate invitation links and return their role arrays.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const orgInvitations = await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, orgId))
      .orderBy(desc(invitations.createdAt));

    const origin = request.nextUrl.origin;

    const invitesWithLinks = orgInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      roles: invite.roles,
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
  } catch (error) {
    return handleRouteError(error, 'List invitations error');
  }
}
