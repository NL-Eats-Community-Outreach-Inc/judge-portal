import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { handleRouteError } from '@/lib/utils/api-errors';

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
    return handleRouteError(error, 'Error fetching organizations');
  }
}
