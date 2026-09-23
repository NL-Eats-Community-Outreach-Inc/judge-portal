import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users, events } from '@/lib/db/schema';
import { eq, and, count, inArray } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

export async function GET(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    await authServer.requireSuperAdmin();
    const { orgId } = await params;

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

    if (!org) {
      return sendApiError(404, 'NOT_FOUND', 'Organization not found');
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
    return handleRouteError(error, 'Error fetching organization');
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
      return sendApiError(404, 'NOT_FOUND', 'Organization not found');
    }

    // Build update values
    const updateValues: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return sendApiError(400, 'BAD_REQUEST', 'Organization name cannot be empty');
      }
      updateValues.name = name.trim();
    }
    if (slug !== undefined) {
      const slugValue = slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-');
      if (!slugValue) {
        return sendApiError(400, 'BAD_REQUEST', 'Organization slug cannot be empty');
      }
      // Check slug uniqueness
      const slugConflict = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(and(eq(organizations.slug, slugValue), ne(organizations.id, orgId)))
        .limit(1);

      if (slugConflict.length > 0) {
        return sendApiError(409, 'CONFLICT', 'An organization with this slug already exists');
      }
      updateValues.slug = slugValue;
    }
    if (description !== undefined) updateValues.description = description?.trim() || null;
    if (logoUrl !== undefined) updateValues.logoUrl = logoUrl?.trim() || null;

    if (Object.keys(updateValues).length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'No fields to update');
    }

    const [updated] = await db
      .update(organizations)
      .set(updateValues)
      .where(eq(organizations.id, orgId))
      .returning();

    return NextResponse.json({ organization: updated });
  } catch (error) {
    return handleRouteError(error, 'Error updating organization');
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
      return sendApiError(404, 'NOT_FOUND', 'Organization not found');
    }

    // The cascade would take live teams and scores with it: refuse while any
    // event is open or active (the same discipline as the event delete guard)
    const [live] = await db
      .select({ id: events.id, name: events.name })
      .from(events)
      .where(and(eq(events.organizationId, orgId), inArray(events.status, ['open', 'active'])))
      .limit(1);

    if (live) {
      return sendApiError(
        400,
        'INVALID_STATUS',
        `Cannot delete an organization with a live event ("${live.name}"); complete or reset it first`
      );
    }

    // Delete org (cascades to events via FK)
    await db.delete(organizations).where(eq(organizations.id, orgId));

    return NextResponse.json({ success: true, message: `Organization "${existing.name}" deleted` });
  } catch (error) {
    return handleRouteError(error, 'Error deleting organization');
  }
}
