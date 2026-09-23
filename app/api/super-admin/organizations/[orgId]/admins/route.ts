import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users, invitations } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  generateInvitationToken,
  calculateExpirationDate,
  getExistingInvitation,
} from '@/lib/auth/invitation';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

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

    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.role, 'admin')))
      .orderBy(users.createdAt);

    return NextResponse.json({ admins });
  } catch (error) {
    return handleRouteError(error, 'Error fetching org admins');
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const user = await authServer.requireSuperAdmin();
    const { orgId } = await params;

    // Verify org exists
    const [org] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      return sendApiError(404, 'NOT_FOUND', 'Organization not found');
    }

    const body = await request.json();
    const { emails, customMessage, expiresInDays = 7 } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'At least one email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email: string) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return sendApiError(
        400,
        'BAD_REQUEST',
        `Invalid email addresses: ${invalidEmails.join(', ')}`
      );
    }

    // Check for existing users and pending invitations
    const existingInvites: string[] = [];
    const alreadyRegistered: { email: string; role: string }[] = [];

    for (const email of emails) {
      // Check existing pending invitation
      const existing = await getExistingInvitation(email, orgId);
      if (existing) {
        existingInvites.push(email);
        continue;
      }

      // Check if user already exists
      const [existingUser] = await db
        .select({ email: users.email, role: users.role })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);

      if (existingUser) {
        alreadyRegistered.push({ email: existingUser.email, role: existingUser.role! });
        continue;
      }
    }

    const newEmails = emails.filter(
      (email: string) =>
        !existingInvites.includes(email) && !alreadyRegistered.find((u) => u.email === email)
    );

    if (newEmails.length === 0) {
      return NextResponse.json({
        message: 'All emails are already invited or registered',
        existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
        alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
      });
    }

    // Insert invitations directly so the organization is stored on each row
    const expiresAt = calculateExpirationDate(expiresInDays);
    const invitationData = newEmails.map((email: string) => ({
      token: generateInvitationToken(),
      email,
      role: 'admin' as const,
      customMessage: customMessage || null,
      expiresAt,
      createdBy: user.id,
      organizationId: orgId,
    }));

    const createdInvitations = await db.insert(invitations).values(invitationData).returning();

    const origin = new URL(request.url).origin;
    const invitesWithLinks = createdInvitations.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json(
      {
        success: true,
        invitations: invitesWithLinks,
        organizationName: org.name,
        existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
        alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error, 'Error inviting admin');
  }
}
