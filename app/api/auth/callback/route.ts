import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/judge';
  const roleParam = searchParams.get('role') as 'admin' | 'judge' | 'participant' | null;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if user already exists in our database using Drizzle
      try {
        const client = postgres(process.env.DATABASE_URL!, { prepare: false });
        const db = drizzle(client, { schema });

        const existingUser = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, data.user.id))
          .limit(1);

        // If user doesn't exist, create them with role from URL or user metadata or default to judge
        if (existingUser.length === 0) {
          // Try to get role from: 1) URL param, 2) user metadata, 3) default to judge
          const userRole =
            roleParam || (data.user.user_metadata?.role as 'admin' | 'judge' | 'participant') || 'judge';

          await db.insert(users).values({
            id: data.user.id,
            email: data.user.email!,
            role: userRole,
          });
          console.log('Created user record for:', data.user.email, 'with role:', userRole);
        }

        await client.end();
      } catch (dbError) {
        console.error('Error managing user record:', dbError);
        // Continue anyway - the middleware will handle it
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`);
}
