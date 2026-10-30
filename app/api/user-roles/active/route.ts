import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { users, userRoles } from '@/lib/db/schema';
import type { AppRole } from '@/lib/theme';

/**
 * Active Role Update API
 *
 * Allows an authenticated user to switch their active application role.
 *
 * This module:
 * 1. Defines the supported application roles and validates role values.
 * 2. Authenticates the user and validates the requested role.
 * 3. Verifies that the requested role is assigned to the user.
 * 4. Updates the user's active role and returns the result.
 *
 * Users can only switch to roles already assigned to their account.
 */

// 1. Define the supported application roles and validate role values.
const APP_ROLES = [
  'admin',
  'judge',
  'participant',
  'super_admin',
  'learner',
] as const satisfies readonly AppRole[];

function isAppRole(role: unknown): role is AppRole {
  return typeof role === 'string' && APP_ROLES.some((allowedRole) => allowedRole === role);
}

export async function PATCH(request: Request) {
  try {
    // 2. Authenticate the user and validate the requested role.
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    const body = await request.json().catch(() => null);
    const requestedRole: unknown = body?.role;

    if (!isAppRole(requestedRole)) {
      return sendApiError(400, 'BAD_REQUEST', 'Invalid role');
    }

    // 3. Verify that the requested role is assigned to the authenticated user.
    const [assignment] = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, requestedRole)))
      .limit(1);

    if (!assignment) {
      return sendApiError(403, 'BAD_REQUEST', 'You are not assigned this role');
    }

    // 4. Update the active role and return the updated value.
    const [updatedUser] = await db
      .update(users)
      .set({ role: assignment.role })
      .where(eq(users.id, user.id))
      .returning({ activeRole: users.role });

    if (!updatedUser) {
      return sendApiError(404, 'BAD_REQUEST', 'User not found');
    }

    return NextResponse.json({
      activeRole: updatedUser.activeRole,
    });
  } catch (error) {
    return handleRouteError(error, 'Error switching active role');
  }
}
