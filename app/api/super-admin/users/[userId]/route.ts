import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, scores } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createAdminClient } from '@/lib/supabase/server';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const currentUser = await authServer.requireSuperAdmin();
    const { userId } = await params;

    // Cannot delete yourself
    if (userId === currentUser.id) {
      return sendApiError(400, 'BAD_REQUEST', 'Cannot delete your own account');
    }

    // Verify user exists
    const [targetUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return sendApiError(404, 'NOT_FOUND', 'User not found');
    }

    // Prevent deletion of other super_admins
    if (targetUser.role === 'super_admin') {
      return sendApiError(403, 'FORBIDDEN', 'Cannot delete super admin users');
    }

    // scores.judge_id cascades: deleting a judge would take their scores out of
    // every result. Admins remove a judge from the organization instead
    const [scored] = await db
      .select({ id: scores.id })
      .from(scores)
      .where(eq(scores.judgeId, userId))
      .limit(1);

    if (scored) {
      return sendApiError(
        400,
        'INVALID_STATUS',
        'This judge has scores; remove them from the organization instead'
      );
    }

    // Delete from database FIRST (removes FK reference to auth.users)
    try {
      await db.delete(users).where(eq(users.id, userId));
    } catch (dbError) {
      console.error('Failed to delete user from database:', userId, dbError);
      return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Failed to delete user');
    }

    // Then delete from Supabase Auth
    const supabase = createAdminClient();
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      console.error('DB deleted but auth delete failed for user:', userId, authError);
    }

    return NextResponse.json({ success: true, message: `User "${targetUser.email}" deleted` });
  } catch (error) {
    return handleRouteError(error, 'Error deleting user');
  }
}
