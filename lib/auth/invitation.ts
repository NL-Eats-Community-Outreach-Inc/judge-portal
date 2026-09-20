import { db } from '@/lib/db';
import { invitations, users, organizationMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { Invitation } from '@/lib/db/schema';
import crypto from 'crypto';

export type InvitationRole = 'admin' | 'judge' | 'participant';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * Generate a unique invitation token
 */
export function generateInvitationToken(): string {
  return crypto.randomUUID();
}

/**
 * Calculate expiration date based on days from now
 */
export function calculateExpirationDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Check if an invitation is valid (not expired, not used, not revoked)
 */
export function isInvitationValid(invitation: Invitation): {
  valid: boolean;
  reason?: string;
} {
  if (invitation.status === 'revoked') {
    return { valid: false, reason: 'This invitation has been revoked' };
  }

  if (invitation.status === 'accepted') {
    return { valid: false, reason: 'This invitation has already been used' };
  }

  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);

  if (now > expiresAt) {
    return { valid: false, reason: 'This invitation has expired' };
  }

  return { valid: true };
}

/**
 * Create multiple invitations (batch)
 */
export async function createBatchInvitations(data: {
  emails: string[];
  role: InvitationRole;
  customMessage?: string;
  expiresInDays?: number;
  createdBy: string;
  organizationId?: string;
}): Promise<Invitation[]> {
  const expiresAt = calculateExpirationDate(data.expiresInDays || 7);

  const invitationData = data.emails.map((email) => ({
    token: generateInvitationToken(),
    email,
    role: data.role,
    customMessage: data.customMessage,
    expiresAt,
    createdBy: data.createdBy,
    organizationId: data.organizationId,
  }));

  const result = await db.insert(invitations).values(invitationData).returning();

  return result;
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);

  return result[0] || null;
}

/**
 * The pending invitation for `email` in `organizationId`, if any. Scoped to the
 * organization (another organization's invitation never blocks this one) and
 * matched ignoring case, like the accept route does.
 */
export async function getExistingInvitation(
  email: string,
  organizationId: string
): Promise<Invitation | null> {
  const result = await db
    .select()
    .from(invitations)
    .where(
      and(
        sql`lower(${invitations.email}) = lower(${email})`,
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, 'pending')
      )
    )
    .limit(1);

  return result[0] || null;
}

/** `db` or the transaction handle a caller is already inside. */
type Executor = Pick<typeof db, 'select' | 'insert' | 'update'>;

/**
 * Accept an invitation (mark as accepted)
 */
export async function acceptInvitation(
  invitationId: string,
  executor: Executor = db
): Promise<void> {
  const invitation = await executor
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  if (!invitation[0]) {
    throw new Error('Invitation not found');
  }

  const validationResult = isInvitationValid(invitation[0]);
  if (!validationResult.valid) {
    throw new Error(validationResult.reason);
  }

  // Mark invitation as accepted
  await executor
    .update(invitations)
    .set({
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invitations.id, invitationId));
}

/**
 * Revoke an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  await db
    .update(invitations)
    .set({
      status: 'revoked',
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invitations.id, invitationId));
}

const ROLE_HOME: Record<InvitationRole, string> = {
  admin: '/admin',
  judge: '/judge',
  participant: '/participant',
};

/** Where a user lands after accepting an invitation for `role`. */
export function invitationRedirectUrl(role: string): string {
  return ROLE_HOME[role as InvitationRole] ?? '/';
}

/**
 * Completes an invitation for a brand-new account: creates the `users` row with
 * the invited role (and the organization for admin invites), adds the judge to
 * the inviting organization, and marks the invitation accepted. The three
 * writes are one transaction, so a failure leaves no profile row behind with
 * the invitation still pending. `authUserId` is the id of the `auth.users` row
 * that was just created; that row cannot be rolled back and the accept route
 * recovers an orphaned one on the next attempt.
 */
export async function finalizeInvitationAcceptance(
  invitation: Invitation,
  authUserId: string
): Promise<{ redirectUrl: string }> {
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: authUserId,
      email: invitation.email,
      role: invitation.role,
      organizationId: invitation.role === 'admin' ? invitation.organizationId : null,
    });

    if (invitation.role === 'judge' && invitation.organizationId) {
      await tx
        .insert(organizationMembers)
        .values({ organizationId: invitation.organizationId, userId: authUserId })
        .onConflictDoNothing();
    }

    await acceptInvitation(invitation.id, tx);
  });

  return { redirectUrl: invitationRedirectUrl(invitation.role) };
}

export type ExistingAccountResult =
  | { accepted: true; redirectUrl: string; message: string }
  | { accepted: false; redirectUrl: string; message: string };

/**
 * Applies an invitation to an account that already exists. Only one case is
 * allowed: a judge invited to another organization gains that membership.
 * Every other combination (role change, admin or participant invite for an
 * existing user, judge already a member) is refused with the user's own home
 * page as the redirect. The caller must have verified that the session
 * belongs to `existingUser`.
 */
export async function acceptInvitationForExistingUser(
  invitation: Invitation,
  existingUser: { id: string; role: string | null }
): Promise<ExistingAccountResult> {
  const homeUrl = invitationRedirectUrl(existingUser.role ?? '');

  const organizationId = invitation.organizationId;
  if (existingUser.role === 'judge' && invitation.role === 'judge' && organizationId) {
    const [membership] = await db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, existingUser.id),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1);

    if (membership) {
      return {
        accepted: false,
        redirectUrl: homeUrl,
        message: 'You are already a member of this organization.',
      };
    }

    await db.transaction(async (tx) => {
      await tx.insert(organizationMembers).values({ organizationId, userId: existingUser.id });
      await acceptInvitation(invitation.id, tx);
    });

    return {
      accepted: true,
      redirectUrl: homeUrl,
      message: 'You have been added to a new organization.',
    };
  }

  return {
    accepted: false,
    redirectUrl: homeUrl,
    message:
      'You already have an account. Please contact an administrator if you need a role change.',
  };
}
