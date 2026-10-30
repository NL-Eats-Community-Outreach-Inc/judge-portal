import { db } from '@/lib/db';
import { invitations, users, userRoles, organizationMembers } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { Invitation } from '@/lib/db/schema';
import crypto from 'crypto';

export type InvitationRole = 'admin' | 'judge' | 'participant' | 'learner';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/**
 * Generate a unique invitation token.
 */
export function generateInvitationToken(): string {
  return crypto.randomUUID();
}

/**
 * Calculate expiration date based on days from now.
 */
export function calculateExpirationDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Check whether an invitation is valid.
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

  if (!invitation.roles || invitation.roles.length === 0) {
    return { valid: false, reason: 'This invitation has no assigned roles' };
  }

  return { valid: true };
}

/**
 * Create multiple invitations, each supporting multiple roles.
 */
export async function createBatchInvitations(data: {
  emails: string[];
  roles: InvitationRole[];
  customMessage?: string;
  expiresInDays?: number;
  createdBy: string;
  organizationId?: string;
}): Promise<Invitation[]> {
  const roles = [...new Set(data.roles)];

  if (roles.length === 0) {
    throw new Error('At least one invitation role is required.');
  }

  if (roles.includes('admin') && !data.organizationId) {
    throw new Error('An organization is required for admin invitations.');
  }

  const expiresAt = calculateExpirationDate(Number(data.expiresInDays ?? 7));

  const invitationData = data.emails.map((email) => ({
    token: generateInvitationToken(),
    email,
    roles,
    customMessage: data.customMessage,
    expiresAt,
    createdBy: data.createdBy,
    organizationId: data.organizationId,
  }));

  return db.insert(invitations).values(invitationData).returning();
}

/**
 * Get an invitation by its token.
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);

  return result[0] || null;
}

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
 * Mark an invitation as accepted.
 */
export async function acceptInvitation(
  invitationId: string,
  executor: Executor = db
): Promise<void> {
  const [invitation] = await executor
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  const validationResult = isInvitationValid(invitation);

  if (!validationResult.valid) {
    throw new Error(validationResult.reason);
  }

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
 * Revoke an invitation.
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
  learner: '/learner',
};

/**
 * Determine the initial destination from an invitation's roles.
 * The first invited role is used for new accounts.
 */
export function invitationRedirectUrl(roles: string | readonly InvitationRole[]): string {
  const initialRole = Array.isArray(roles) ? roles[0] : roles;

  return ROLE_HOME[initialRole as InvitationRole] ?? '/';
}

/**
 * Assign every invited role to a user.
 * Existing assignments are preserved and duplicates are ignored.
 */
async function assignInvitationRoles(
  executor: Executor,
  invitation: Invitation,
  userId: string
): Promise<void> {
  await executor
    .insert(userRoles)
    .values(
      invitation.roles.map((role) => ({
        userId,
        role,
        grantedBy: invitation.createdBy,
        grantedSource: 'invitation',
      }))
    )
    .onConflictDoNothing();
}

/**
 * Add the invited user to the organization when the invitation
 * includes a Judge role.
 */
async function addJudgeOrganizationMembership(
  executor: Executor,
  invitation: Invitation,
  userId: string
): Promise<void> {
  if (!invitation.roles.includes('judge') || !invitation.organizationId) {
    return;
  }

  await executor
    .insert(organizationMembers)
    .values({
      organizationId: invitation.organizationId,
      userId,
    })
    .onConflictDoNothing();
}

/**
 * Completes an invitation for a brand-new account.
 *
 * Creates the user profile, assigns every invited role, adds
 * organization memberships where applicable, and accepts the invitation.
 * All database writes are performed in one transaction.
 */
export async function finalizeInvitationAcceptance(
  invitation: Invitation,
  authUserId: string
): Promise<{ redirectUrl: string }> {
  if (invitation.roles.length === 0) {
    throw new Error('Invitation must contain at least one role.');
  }

  if (invitation.roles.includes('admin') && !invitation.organizationId) {
    throw new Error('An organization is required for admin invitations.');
  }

  await db.transaction(async (tx) => {
    const initialRole = invitation.roles[0];

    await tx.insert(users).values({
      id: authUserId,
      email: invitation.email,
      role: initialRole,
      organizationId: invitation.roles.includes('admin') ? invitation.organizationId : null,
    });

    await assignInvitationRoles(tx, invitation, authUserId);

    await addJudgeOrganizationMembership(tx, invitation, authUserId);

    await acceptInvitation(invitation.id, tx);
  });

  return {
    redirectUrl: invitationRedirectUrl(invitation.roles),
  };
}

export type ExistingAccountResult =
  | { accepted: true; redirectUrl: string; message: string }
  | { accepted: false; redirectUrl: string; message: string };

/**
 * Applies an invitation to an account that already exists.
 *
 * Adds missing roles without removing existing assignments.
 * Preserves the user's current active role.
 *
 * Admin invitations cannot overwrite an existing organization association.
 * Judge invitations add organization membership independently.
 */
export async function acceptInvitationForExistingUser(
  invitation: Invitation,
  existingUser: { id: string; role: string | null }
): Promise<ExistingAccountResult> {
  const homeUrl = invitationRedirectUrl(existingUser.role ?? '');

  if (invitation.roles.length === 0) {
    return {
      accepted: false,
      redirectUrl: homeUrl,
      message: 'This invitation does not contain any roles.',
    };
  }

  if (invitation.roles.includes('admin') && !invitation.organizationId) {
    return {
      accepted: false,
      redirectUrl: homeUrl,
      message: 'An organization is required for admin invitations.',
    };
  }

  const [account] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, existingUser.id))
    .limit(1);

  if (!account) {
    return {
      accepted: false,
      redirectUrl: homeUrl,
      message: 'User account not found.',
    };
  }

  // Do not silently move an existing account to another organization.
  if (
    invitation.roles.includes('admin') &&
    account.organizationId &&
    account.organizationId !== invitation.organizationId
  ) {
    return {
      accepted: false,
      redirectUrl: homeUrl,
      message:
        'This account is already associated with another organization. Contact an administrator to resolve the organization assignment.',
    };
  }

  await db.transaction(async (tx) => {
    // Associate an existing account with the organization only if
    // it does not already have an organization assigned.
    if (invitation.roles.includes('admin') && !account.organizationId) {
      await tx
        .update(users)
        .set({ organizationId: invitation.organizationId })
        .where(eq(users.id, existingUser.id));
    }

    // Add all invited roles without replacing existing assignments.
    await assignInvitationRoles(tx, invitation, existingUser.id);

    // Add Judge organization membership when applicable.
    await addJudgeOrganizationMembership(tx, invitation, existingUser.id);

    // Mark the invitation accepted in the same transaction.
    await acceptInvitation(invitation.id, tx);
  });

  return {
    accepted: true,
    redirectUrl: homeUrl,
    message: 'Your invitation has been accepted and your assigned roles have been updated.',
  };
}
