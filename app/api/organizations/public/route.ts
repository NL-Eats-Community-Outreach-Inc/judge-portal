import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';

/**
 * GET /api/organizations/public
 * Returns a public list of organizations for the signup form.
 * No authentication required.
 */
export async function GET() {
  try {
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        description: organizations.description,
      })
      .from(organizations)
      .orderBy(organizations.name);

    return NextResponse.json({ organizations: orgs });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
