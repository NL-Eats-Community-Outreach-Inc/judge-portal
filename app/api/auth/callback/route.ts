import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, organizationMembers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';

type Role = 'super_admin' | 'admin' | 'judge' | 'participant';

/**
 * OAuth / magic-link code exchange. Creates the profile row when the trigger
 * did not (role from the URL, then user metadata, then `judge`).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/judge';
  const roleParam = searchParams.get('role') as Role | null;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      try {
        const existingUser = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, data.user.id))
          .limit(1);

        if (existingUser.length === 0) {
          const userRole = roleParam || (data.user.user_metadata?.role as Role) || 'judge';

          await db.insert(users).values({
            id: data.user.id,
            email: data.user.email!,
            role: userRole,
          });

          if (userRole === 'judge') {
            const orgIds = (data.user.user_metadata?.organization_ids as string[]) || [];
            for (const orgId of orgIds) {
              try {
                await db
                  .insert(organizationMembers)
                  .values({ organizationId: orgId, userId: data.user.id })
                  .onConflictDoNothing();
              } catch (e) {
                console.error('Error creating org membership:', e);
              }
            }
          }
        }
      } catch (dbError) {
        // The middleware sends users without a profile row to sign-up
        console.error('Error managing user record:', dbError);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
