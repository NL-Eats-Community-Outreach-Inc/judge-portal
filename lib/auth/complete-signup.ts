import { db } from '@/lib/db';
import { organizationMembers, userRoles, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const SIGNUP_ROLES = ['judge', 'participant', 'learner'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

function isSignupRole(value: unknown): value is SignupRole {
  return typeof value === 'string' && SIGNUP_ROLES.includes(value as SignupRole);
}

export async function completeSignup(
  userId: string,
  email: string,
  metadata: Record<string, unknown>
) {
  // Only the three public signup roles are allowed here.
  // Admin and super_admin must come through trusted administrative flows.
  const requestedRoles = Array.isArray(metadata.roles) ? metadata.roles.filter(isSignupRole) : [];

  // Backward compatibility with the existing single-role signup metadata.
  const roles = [
    ...new Set(
      requestedRoles.length > 0
        ? requestedRoles
        : isSignupRole(metadata.role)
          ? [metadata.role]
          : []
    ),
  ];

  if (roles.length === 0) {
    throw new Error('No valid signup roles were provided.');
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // The auth trigger normally creates this row for password signup.
  // OTP signup skips the trigger, so we create the row if necessary.
  if (!existingUser) {
    await db
      .insert(users)
      .values({
        id: userId,
        email,
        role: roles[0],
      })
      .onConflictDoNothing();
  }

  // Add every selected role, safely handling retries.
  for (const role of roles) {
    await db
      .insert(userRoles)
      .values({
        userId,
        role,
        grantedSource: 'self_signup',
      })
      .onConflictDoNothing();
  }

  // Organization membership is relevant only when Judge was selected.
  if (roles.includes('judge') && Array.isArray(metadata.organization_ids)) {
    const orgIds = [
      ...new Set(metadata.organization_ids.filter((id): id is string => typeof id === 'string')),
    ];

    for (const organizationId of orgIds) {
      await db
        .insert(organizationMembers)
        .values({
          organizationId,
          userId,
        })
        .onConflictDoNothing();
    }
  }

  return { roles, activeRole: roles[0] };
}
