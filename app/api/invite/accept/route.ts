import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import {
  getInvitationByToken,
  isInvitationValid,
  finalizeInvitationAcceptance,
  acceptInvitationForExistingUser,
} from '@/lib/auth/invitation';
import { createAdminClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

const MIN_PASSWORD_LENGTH = 6;

/**
 * POST /api/invite/accept  { token, password? }
 *
 * Accepts an invitation without sending any email. A new account is created
 * with the given password; the page then signs in with it. If the invited
 * email already has an account, the caller must be logged in as that account
 * (no password is accepted then), and only a judge joining another
 * organization is applied.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token) {
      return sendApiError(400, 'BAD_REQUEST', 'Token is required');
    }

    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      return sendApiError(404, 'NOT_FOUND', 'Invalid invitation');
    }

    const validationResult = isInvitationValid(invitation);
    if (!validationResult.valid) {
      return sendApiError(
        400,
        'INVITATION_INVALID',
        validationResult.reason ?? 'Invalid invitation'
      );
    }

    const [existingUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${invitation.email})`)
      .limit(1);

    if (existingUser) {
      // Only the account's own session may apply an invitation to it
      const sessionUser = await authServer.getUser();
      if (!sessionUser || sessionUser.id !== existingUser.id) {
        return sendApiError(
          409,
          'EXISTING_ACCOUNT',
          'This email already has an account. Log in to accept the invitation.'
        );
      }

      const result = await acceptInvitationForExistingUser(invitation, existingUser);
      if (!result.accepted) {
        return sendApiError(400, 'ALREADY_HAS_ACCOUNT', result.message, {
          redirectUrl: result.redirectUrl,
        });
      }
      return NextResponse.json({
        success: true,
        redirectUrl: result.redirectUrl,
        message: result.message,
      });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return sendApiError(
        400,
        'INVALID_PASSWORD',
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }

    // No email is sent: the account is created confirmed with the chosen
    // password. `invite_pending` keeps the handle_new_user trigger from
    // inserting a default-role profile row; the helper inserts the real one.
    const supabase = createAdminClient();
    const created = await supabase.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: { invite_pending: true, role: invitation.role },
    });

    let authUserId = created.data.user?.id;

    if (created.error) {
      // An auth user without a profile row (for example from an OTP invitation
      // that was never verified) cannot use the app at all; a valid invitation
      // for that exact email claims it by setting the password.
      const orphan = await findAuthUserByEmail(supabase, invitation.email);
      if (!orphan) {
        console.error('Invitation accept: auth user creation failed', created.error);
        return sendApiError(500, 'ACCOUNT_CREATION_FAILED', 'Could not create the account');
      }
      const [profileById] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, orphan.id))
        .limit(1);
      if (profileById) {
        return sendApiError(
          409,
          'EXISTING_ACCOUNT',
          'This email already has an account. Log in to accept the invitation.'
        );
      }
      const updated = await supabase.auth.admin.updateUserById(orphan.id, {
        password,
        email_confirm: true,
        user_metadata: { ...orphan.user_metadata, invite_pending: true, role: invitation.role },
      });
      if (updated.error) {
        console.error('Invitation accept: password update failed', updated.error);
        return sendApiError(500, 'ACCOUNT_CREATION_FAILED', 'Could not create the account');
      }
      authUserId = orphan.id;
    }

    if (!authUserId) {
      return sendApiError(500, 'ACCOUNT_CREATION_FAILED', 'Could not create the account');
    }

    const { redirectUrl } = await finalizeInvitationAcceptance(invitation, authUserId);

    return NextResponse.json({ success: true, redirectUrl, email: invitation.email });
  } catch (error) {
    return handleRouteError(error, 'Invitation accept error');
  }
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createAdminClient>, email: string) {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}
