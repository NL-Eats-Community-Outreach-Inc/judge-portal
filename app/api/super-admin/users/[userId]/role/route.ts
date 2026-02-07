import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const VALID_ROLES = ['admin', 'judge', 'participant'] as const;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await authServer.requireSuperAdmin();
    const { userId } = await params;
    const { role, organizationId } = await request.json();

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    // Cannot change own role
    if (userId === currentUser.id) {
      return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
    }

    // Verify user exists
    const [targetUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot change another super_admin's role
    if (targetUser.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot change super admin role' }, { status: 403 });
    }

    // When promoting to admin, organizationId is required
    if (role === 'admin' && !organizationId) {
      return NextResponse.json(
        { error: 'Organization is required when assigning admin role' },
        { status: 400 }
      );
    }

    // Set organizationId: use provided value for admin, null for others
    const orgId = role === 'admin' ? organizationId : null;

    const [updatedUser] = await db
      .update(users)
      .set({
        role,
        organizationId: orgId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId))
      .returning();

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error updating user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
