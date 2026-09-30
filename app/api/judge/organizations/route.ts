import { NextRequest, NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizationMembers, organizations } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';

/**
 * GET /api/judge/organizations
 * Returns the judge's current organization memberships
 */
export async function GET() {
  try {
    const user = await authServer.requireJudge();

    const memberships = await db
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgDescription: organizations.description,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, user.id))
      .orderBy(organizations.name);

    return NextResponse.json({ memberships });
  } catch (error) {
    return handleRouteError(error, 'Error fetching judge organizations');
  }
}

/**
 * POST /api/judge/organizations
 * Join new organization(s)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authServer.requireJudge();

    const body = await request.json();
    const { organizationIds } = body;

    if (!organizationIds || !Array.isArray(organizationIds) || organizationIds.length === 0) {
      return sendApiError(400, 'BAD_REQUEST', 'At least one organization ID is required');
    }

    // Validate that all orgs exist
    const existingOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(inArray(organizations.id, organizationIds));

    const existingOrgIds = new Set(existingOrgs.map((o) => o.id));
    const invalidIds = organizationIds.filter((id: string) => !existingOrgIds.has(id));
    if (invalidIds.length > 0) {
      return sendApiError(400, 'BAD_REQUEST', 'Some organizations do not exist');
    }

    // Check current memberships
    const currentMemberships = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, user.id),
          inArray(organizationMembers.organizationId, organizationIds)
        )
      );

    const alreadyMemberIds = new Set(currentMemberships.map((m) => m.organizationId));
    const newOrgIds = organizationIds.filter((id: string) => !alreadyMemberIds.has(id));

    if (newOrgIds.length > 0) {
      await db
        .insert(organizationMembers)
        .values(
          newOrgIds.map((orgId: string) => ({
            organizationId: orgId,
            userId: user.id,
          }))
        )
        .onConflictDoNothing();
    }

    return NextResponse.json({
      joined: newOrgIds.length,
      alreadyMember: alreadyMemberIds.size,
    });
  } catch (error) {
    return handleRouteError(error, 'Error joining organizations');
  }
}
