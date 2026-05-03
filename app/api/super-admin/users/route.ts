import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, organizations, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sendApiError } from '@/lib/utils/api-errors';

export async function GET() {
  try {
    await authServer.requireSuperAdmin();

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        organizationId: users.organizationId,
        organizationName: organizations.name,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(organizations, eq(users.organizationId, organizations.id))
      .orderBy(users.createdAt);

    // Fetch org memberships for judges (many-to-many via organization_members)
    const memberships = await db
      .select({
        userId: organizationMembers.userId,
        orgId: organizations.id,
        orgName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId));

    // Group memberships by user ID
    const membershipsByUser = new Map<string, { id: string; name: string }[]>();
    for (const m of memberships) {
      const list = membershipsByUser.get(m.userId) || [];
      list.push({ id: m.orgId, name: m.orgName });
      membershipsByUser.set(m.userId, list);
    }

    // Attach org memberships to each user
    const usersWithMemberships = allUsers.map((u) => ({
      ...u,
      organizationMemberships: membershipsByUser.get(u.id) || [],
    }));

    return NextResponse.json({ users: usersWithMemberships });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(403, 'FORBIDDEN', 'Unauthorized');
    }
    console.error('Error fetching users:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
