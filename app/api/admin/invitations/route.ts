import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import {
  createBatchInvitations,
  getAllInvitations,
  getExistingInvitation,
} from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/admin/invitations
 * Create invitations (batch supported)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin role
    const user = await authServer.requireAdmin();

    const body = await request.json();
    const { emails, role = 'judge', customMessage, expiresInDays = 7 } = body;

    // Validation
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'At least one email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: 'Invalid email addresses', invalidEmails },
        { status: 400 }
      );
    }

    // Check for existing pending invitations
    const existingInvites: string[] = [];
    for (const email of emails) {
      const existing = await getExistingInvitation(email);
      if (existing) {
        existingInvites.push(email);
      }
    }

    // Check for already registered users
    const alreadyRegistered: Array<{ email: string; role: string }> = [];
    for (const email of emails) {
      const existingUser = await db
        .select({ email: users.email, role: users.role })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser[0]) {
        alreadyRegistered.push({
          email: existingUser[0].email!,
          role: existingUser[0].role!,
        });
      }
    }

    // Filter out emails with existing invitations or registered users
    const registeredEmails = alreadyRegistered.map(u => u.email);
    const newEmails = emails.filter(
      email => !existingInvites.includes(email) && !registeredEmails.includes(email)
    );

    if (newEmails.length === 0) {
      return NextResponse.json(
        {
          message: 'All emails are already invited or registered',
          existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
          alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
        },
        { status: 200 }
      );
    }

    // Create invitations
    const invitations = await createBatchInvitations({
      emails: newEmails,
      role,
      customMessage,
      expiresInDays,
      createdBy: user.id,
    });

    // Generate invite links
    const origin = request.nextUrl.origin;
    const invitesWithLinks = invitations.map(invite => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json({
      success: true,
      invitations: invitesWithLinks,
      existingInvites: existingInvites.length > 0 ? existingInvites : undefined,
      alreadyRegistered: alreadyRegistered.length > 0 ? alreadyRegistered : undefined,
    });
  } catch (error: any) {
    console.error('Create invitations error:', error);

    if (error.message?.includes('role required')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/invitations
 * List all invitations
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    await authServer.requireAdmin();

    const invitations = await getAllInvitations();

    // Generate invite links
    const origin = request.nextUrl.origin;
    const invitesWithLinks = invitations.map(invite => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      customMessage: invite.customMessage,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      createdAt: invite.createdAt,
      inviteLink: `${origin}/invite/${invite.token}`,
    }));

    return NextResponse.json({
      success: true,
      invitations: invitesWithLinks,
    });
  } catch (error: any) {
    console.error('List invitations error:', error);

    if (error.message?.includes('role required')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
