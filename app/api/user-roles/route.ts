import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authServer } from '@/lib/auth';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import { users, userRoles } from '@/lib/db/schema';

/**
 * User Roles API — Retrieve Assigned Roles
 *
 * Returns the authenticated user's active role and assigned application roles.
 *
 * This endpoint:
 * 1. Authenticates the requesting user.
 * 2. Retrieves the user's currently active role.
 * 3. Fetches all roles assigned to the user's account.
 * 4. Returns the active role and ordered role list.
 *
 * Only roles belonging to the authenticated user are returned.
 */

export async function GET() {
  try {
    // 1. Authenticate the requesting user.
    const user = await authServer.getUser();

    if (!user) {
      return sendApiError(401, 'BAD_REQUEST', 'Unauthorized');
    }

    // 2. Retrieve the user's currently active role.
    const [account] = await db
      .select({ activeRole: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!account) {
      return sendApiError(404, 'BAD_REQUEST', 'User not found');
    }

    // 3. Fetch all roles assigned to the user, ordered by role.
    const assignedRoles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id))
      .orderBy(asc(userRoles.role));

    // 4. Return the active role and assigned roles.
    return NextResponse.json({
      activeRole: account.activeRole,
      roles: assignedRoles.map(({ role }) => role),
    });
  } catch (error) {
    return handleRouteError(error, 'Error fetching user roles');
  }
}
