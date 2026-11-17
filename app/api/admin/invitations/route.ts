import { NextRequest, NextResponse } from 'next/server';
import { authServer, createBatchInvitations, getExistingInvitation } from '@/lib/auth';
import { db } from '@/lib/db';
import { invitations, users, userRoles, organizationMembers } from '@/lib/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

const VALID_ROLES = ['admin', 'judge', 'participant', 'learner'] as const;

type InvitationRole = (typeof VALID_ROLES)[number];

/**
 * POST /api/admin/invitations
 *
 * Supports:
 * - Existing pending invitation detection.
 * - Automatic organization membership for existing judges.
 * - Existing registered account detection.
 * - New multi-role invitation creation.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    const body = await request.json();
    const { emails, customMessage, expiresInDays = 7 } = body;

    // Support both the new roles array and legacy single-role property.
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

    // 1. Find emails that already have pending invitations.
    const existingInvites: string[] = [];

    for (const email of normalizedEmails) {
      const existing = await getExistingInvitation(email, orgId);

      if (existing) {
        existingInvites.push(email);
      }
    }

    const existingInviteSet = new Set(existingInvites);

    const remainingEmails = normalizedEmails.filter((email) => !existingInviteSet.has(email));

    // 2. Find accounts that already exist.
    const existingUsers = remainingEmails.length
      ? await db
          .select({
            id: users.id,
            email: users.email,
            activeRole: users.role,
            assignedRole: userRoles.role,
          })
          .from(users)
          .leftJoin(userRoles, eq(userRoles.userId, users.id))
          .where(inArray(sql`lower(${users.email})`, remainingEmails))
      : [];

    // Combine the joined role rows into one entry per account.
    const accountMap = new Map<
      string,
      {
        id: string;
        email: string;
        roles: Set<string>;
      }
    >();

    for (const row of existingUsers) {
      const email = row.email.toLowerCase();

      let account = accountMap.get(row.id);

      if (!account) {
        account = {
          id: row.id,
          email,
          roles: new Set<string>(),
        };

        accountMap.set(row.id, account);
      }

      // Preserve the legacy active role as well as assigned roles.
      if (row.activeRole) {
        account.roles.add(row.activeRole);
      }

      if (row.assignedRole) {
        account.roles.add(row.assignedRole);
      }
    }

    const existingUserEmails = new Set([...accountMap.values()].map((account) => account.email));

    const newEmails = remainingEmails.filter((email) => !existingUserEmails.has(email));

    // 3. Automatically add existing judges when the request is
    // exclusively for the judge role.
    const autoAdded: Array<{ email: string }> = [];
    const alreadyRegistered: Array<{
      email: string;
      roles: string[];
    }> = [];

    const judgeOnlyRequest = roles.length === 1 && roles[0] === 'judge';

    const judgeMemberships: Array<{
      organizationId: string;
      userId: string;
    }> = [];

    for (const account of accountMap.values()) {
      const isJudge = account.roles.has('judge');

      if (judgeOnlyRequest && isJudge) {
        judgeMemberships.push({
          organizationId: orgId,
          userId: account.id,
        });

        autoAdded.push({ email: account.email });
      } else {
        alreadyRegistered.push({
          email: account.email,
          roles: [...account.roles],
        });
      }
    }

    if (judgeMemberships.length > 0) {
      await db.insert(organizationMembers).values(judgeMemberships).onConflictDoNothing();
    }

    // 4. Create invitations only for genuinely new accounts.
    const createdInvitations = newEmails.length
      ? await createBatchInvitations({
          emails: newEmails,
          roles,
          customMessage,
          expiresInDays,
          createdBy: user.id,
          organizationId: orgId,
        })
      : [];

    // 5. Generate invitation links.
    const origin = request.nextUrl.origin;

    const invitesWithLinks = createdInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      roles: invite.roles,
      status: invite.status,
      expiresAt: invite.expiresAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    const hasNewInvitations = invitesWithLinks.length > 0;

    return NextResponse.json(
      {
        success: true,
        invitations: invitesWithLinks,
        existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
        alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
        autoAdded: autoAdded.length > 0 ? autoAdded : undefined,
      },
      { status: hasNewInvitations ? 201 : 200 }
    );
  } catch (error) {
    return handleRouteError(error, 'Create invitations error');
  }
}

/**
 * GET /api/admin/invitations
 *
 * Lists invitations belonging to the administrator's organization.
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
