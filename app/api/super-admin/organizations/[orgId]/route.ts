import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, users, events } from '@/lib/db/schema';
import { eq, and, ne, count } from 'drizzle-orm';
import { sendApiError } from '@/lib/utils/api-errors';

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
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(403, 'FORBIDDEN', 'Unauthorized');
    }
    console.error('Error fetching organization:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
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
      // Check slug uniqueness (excluding self)
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
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(403, 'FORBIDDEN', 'Unauthorized');
    }
    console.error('Error updating organization:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
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

    // Delete org (cascades to events via FK)
    await db.delete(organizations).where(eq(organizations.id, orgId));

    return NextResponse.json({ success: true, message: `Organization "${existing.name}" deleted` });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return sendApiError(403, 'FORBIDDEN', 'Unauthorized');
    }
    console.error('Error deleting organization:', error);
    return sendApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
  }
}
