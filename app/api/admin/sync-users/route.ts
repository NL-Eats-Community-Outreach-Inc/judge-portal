import { NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // Get all auth users
    const {
      data: { users: authUsers },
      error: authError,
    } = await supabase.auth.admin.listUsers();

    if (authError) {
      return NextResponse.json({ error: 'Failed to fetch auth users' }, { status: 500 });
    }

    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    const db = drizzle(client, { schema });
    const results = [];

    try {
      for (const authUser of authUsers) {
        // Check if user exists in our database using Drizzle
        const existingUser = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, authUser.id))
          .limit(1);

        if (existingUser.length === 0) {
          // Create missing user record
          try {
            await db.insert(users).values({
              id: authUser.id,
              email: authUser.email!,
              role: 'judge',
            });
            results.push({ id: authUser.id, email: authUser.email, action: 'created' });
          } catch (error) {
            results.push({
              id: authUser.id,
              email: authUser.email,
              action: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        } else {
          results.push({
            id: authUser.id,
            email: authUser.email,
            action: 'exists',
            role: existingUser[0].role,
          });
        }
      }
    } finally {
      await client.end();
    }

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
