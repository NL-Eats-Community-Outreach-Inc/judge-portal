import { db } from '@/lib/db';
import { invitations, eventJudges } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { Invitation } from '@/lib/db/schema';
import crypto from 'crypto';

export type InvitationRole = 'judge' | 'participant';
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
 * Create a new invitation
 */
export async function createInvitation(data: {
  eventId: string;
  email: string;
  role: InvitationRole;
  customMessage?: string;
  expiresInDays?: number;
  createdBy: string;
}): Promise<Invitation> {
  const token = generateInvitationToken();
  const expiresAt = calculateExpirationDate(data.expiresInDays || 7);

  const [invitation] = await db
    .insert(invitations)
    .values({
      token,
      eventId: data.eventId,
      email: data.email,
      role: data.role,
      customMessage: data.customMessage,
      expiresAt,
      createdBy: data.createdBy,
    })
    .returning();

  return invitation;
}

/**
 * Create multiple invitations (batch)
 */
export async function createBatchInvitations(data: {
  eventId: string;
  emails: string[];
  role: InvitationRole;
  customMessage?: string;
  expiresInDays?: number;
  createdBy: string;
}): Promise<Invitation[]> {
  const expiresAt = calculateExpirationDate(data.expiresInDays || 7);

  const invitationData = data.emails.map(email => ({
    token: generateInvitationToken(),
    eventId: data.eventId,
    email,
    role: data.role,
    customMessage: data.customMessage,
    expiresAt,
    createdBy: data.createdBy,
  }));

  const result = await db
    .insert(invitations)
    .values(invitationData)
    .returning();

  return result;
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(
  token: string
): Promise<Invitation | null> {
  const result = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  return result[0] || null;
}

/**
 * Get invitations by event ID
 */
export async function getInvitationsByEvent(
  eventId: string
): Promise<Invitation[]> {
  return db
    .select()
    .from(invitations)
    .where(eq(invitations.eventId, eventId))
    .orderBy(desc(invitations.createdAt));
}

/**
 * Check if invitation exists for email and event
 */
export async function getExistingInvitation(
  email: string,
  eventId: string
): Promise<Invitation | null> {
  const result = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email),
        eq(invitations.eventId, eventId),
        eq(invitations.status, 'pending')
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Accept an invitation (mark as accepted and create user assignment)
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const invitation = await db
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
  await db
    .update(invitations)
    .set({
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(invitations.id, invitationId));

  // Assign user to event
  if (invitation[0].role === 'judge') {
    await db
      .insert(eventJudges)
      .values({
        eventId: invitation[0].eventId,
        judgeId: userId,
      })
      .onConflictDoNothing();
  }
  // For participants, assignment logic will be added when participant feature is implemented
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

/**
 * Update expired invitations status
 * Run this periodically or on-demand to mark expired invitations
 */
export async function markExpiredInvitations(): Promise<number> {
  const result = await db
    .update(invitations)
    .set({
      status: 'expired',
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(invitations.status, 'pending'),
        // @ts-ignore - SQL comparison
        db.sql`expires_at < now()`
      )
    )
    .returning({ id: invitations.id });

  return result.length;
}
