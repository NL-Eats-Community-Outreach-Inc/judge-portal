import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { or, and, eq } from 'drizzle-orm';
import { getAdminOrgId } from '@/lib/auth/org';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = await getAdminOrgId(user.id);

    // Get admins from own org + all judges/participants (global)
    const allUsers = await db
      .select()
      .from(users)
      .where(
        or(
          and(eq(users.organizationId, orgId), eq(users.role, 'admin')),
          eq(users.role, 'judge'),
          eq(users.role, 'participant')
        )
      )
      .orderBy(users.createdAt);

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
