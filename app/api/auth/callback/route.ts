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

        // If user doesn't exist, create them with default judge role
        if (existingUser.length === 0) {
          await db.insert(users).values({
            id: data.user.id,
            email: data.user.email!,
            role: 'judge',
          });
          console.log('Created user record for:', data.user.email);
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
