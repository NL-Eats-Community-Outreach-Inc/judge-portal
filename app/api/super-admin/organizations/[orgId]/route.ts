import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users, events } from '@/lib/db/schema';
import { eq, and, ne, count } from 'drizzle-orm';

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get counts separately for reliability
    const [adminCountResult] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.organizationId, orgId), eq(users.role, 'admin')));

    const [eventCountResult] = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.organizationId, orgId));

    return NextResponse.json({
      organization: {
        ...org,
        adminCount: adminCountResult?.count ?? 0,
        eventCount: eventCountResult?.count ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error fetching organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;
    const { name, slug, description, logoUrl } = await request.json();

    // Verify org exists
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Build update values
    const updateValues: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json({ error: 'Organization name cannot be empty' }, { status: 400 });
      }
      updateValues.name = name.trim();
    }
    if (slug !== undefined) {
      const slugValue = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-');
      if (!slugValue) {
        return NextResponse.json({ error: 'Organization slug cannot be empty' }, { status: 400 });
      }
      // Check slug uniqueness (excluding self)
      const slugConflict = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.slug, slugValue), ne(organizations.id, orgId)))
        .limit(1);

      if (slugConflict.length > 0) {
        return NextResponse.json(
          { error: 'An organization with this slug already exists' },
          { status: 409 }
        );
      }
      updateValues.slug = slugValue;
    }
    if (description !== undefined) updateValues.description = description?.trim() || null;
    if (logoUrl !== undefined) updateValues.logoUrl = logoUrl?.trim() || null;

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(organizations)
      .set(updateValues)
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({ organization: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error updating organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;

    // Verify org exists
    const [existing] = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Delete org (cascades to events via FK)
    await db.delete(organizations).where(eq(organizations.id, orgId));

    return NextResponse.json({ success: true, message: `Organization "${existing.name}" deleted` });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('Error deleting organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
