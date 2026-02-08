import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users, events } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

export async function GET() {
  try {
    await authServer.requireSuperAdmin();

    // Fetch orgs
    const orgs = await db.select().from(organizations).orderBy(organizations.createdAt);

    // Fetch admin counts per org
    const adminCounts = await db
      .select({
        organizationId: users.organizationId,
        count: count(),
      })
      .from(users)
      .where(and(eq(users.role, 'admin')))
      .groupBy(users.organizationId);

    // Fetch event counts per org
    const eventCounts = await db
      .select({
        organizationId: events.organizationId,
        count: count(),
      })
      .from(events)
      .groupBy(events.organizationId);

    // Merge stats
    const orgsWithStats = orgs.map((org) => ({
      ...org,
      adminCount: adminCounts.find((c) => c.organizationId === org.id)?.count ?? 0,
      eventCount: eventCounts.find((c) => c.organizationId === org.id)?.count ?? 0,
    }));

    return NextResponse.json({ organizations: orgsWithStats });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await authServer.requireSuperAdmin();

    const { name, slug, description, logoUrl } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    if (!slug || !slug.trim()) {
      return NextResponse.json({ error: 'Organization slug is required' }, { status: 400 });
    }

    const slugValue = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    // Check slug uniqueness
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slugValue))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An organization with this slug already exists' },
        { status: 409 }
      );
    }

    const [org] = await db
      .insert(organizations)
      .values({
        name: name.trim(),
        slug: slugValue,
        description: description?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
      })
      .returning();

    return NextResponse.json(
      { organization: { ...org, adminCount: 0, eventCount: 0 } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error creating organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
