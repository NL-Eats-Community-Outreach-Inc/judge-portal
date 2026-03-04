import { db } from '@/lib/db';
import { users, events, competitions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class OrphanedAdminError extends Error {
  constructor() {
    super('Admin user is not assigned to an organization');
    this.name = 'OrphanedAdminError';
  }
}

/**
 * Get the organization ID for an admin user.
 * Throws OrphanedAdminError if the user has no organization assigned.
 */
export async function getAdminOrgId(userId: string): Promise<string> {
  const result = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const orgId = result[0]?.organizationId;
  if (!orgId) {
    throw new OrphanedAdminError();
  }
  return orgId;
}

/**
 * Check if an event belongs to a specific organization.
 */
export async function verifyEventInOrg(eventId: string, orgId: string): Promise<boolean> {
  const result = await db
    .select({ organizationId: events.organizationId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  return result[0]?.organizationId === orgId;
}

/**
 * Require that an event belongs to a specific organization.
 * Throws an error if the event doesn't exist or doesn't belong to the org.
 */
export async function requireEventInOrg(eventId: string, orgId: string): Promise<void> {
  const belongs = await verifyEventInOrg(eventId, orgId);
  if (!belongs) {
    throw new Error('Event does not belong to your organization');
  }
}

/**
 * Check if a competition belongs to a specific organization.
 */
export async function verifyCompetitionInOrg(
  competitionId: string,
  orgId: string
): Promise<boolean> {
  const result = await db
    .select({ organizationId: competitions.organizationId })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  return result[0]?.organizationId === orgId;
}

/**
 * Require that a competition belongs to a specific organization.
 * Throws an error if the competition doesn't exist or doesn't belong to the org.
 */
export async function requireCompetitionInOrg(competitionId: string, orgId: string): Promise<void> {
  const belongs = await verifyCompetitionInOrg(competitionId, orgId);
  if (!belongs) {
    throw new Error('Competition does not belong in your organization');
  }
}
