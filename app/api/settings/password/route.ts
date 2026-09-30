import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function POST(request: NextRequest) {
  try {
    await authServer.requireAuth();
    // The password update must go through the session-bound client
    const supabase = await createClient();

    const body = await request.json();
    const { newPassword } = body;

    // Validate input
    if (!newPassword || newPassword.length < 6) {
      return sendApiError(400, 'BAD_REQUEST', 'Password must be at least 6 characters long');
    }

    // Update password - user is already authenticated via session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return sendApiError(400, 'PASSWORD_UPDATE_FAILED', updateError.message);
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return handleRouteError(error, 'Password update error');
  }
}
