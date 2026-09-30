import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, organizationMembers, invitations } from '@/lib/db/schema';
import { desc, inArray, sql } from 'drizzle-orm';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminOrgId } from '@/lib/auth/org';
import { sendApiError, handleRouteError } from '@/lib/utils/api-errors';
import type { User as AuthUser } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

/** The roles a synced profile can get; `super_admin` is never one of them. */
const SYNCABLE_ROLES = ['admin', 'judge', 'participant'] as const;
type SyncableRole = (typeof SYNCABLE_ROLES)[number];

function isSyncableRole(value: unknown): value is SyncableRole {
  return typeof value === 'string' && (SYNCABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Creates the missing `public.users` row for every auth user that has none,
 * in the calling admin's organization. Used on event day when a judge's
 * profile row is missing (they land on the sign-up page after logging in).
 *
 * Role: the invitation for that email if one exists (latest, any status),
 * else the sign-up metadata when it names a real role, else `judge`.
 * Organization: admins get it on the profile row, judges get a membership so
 * Judge Assignments can list them; participants attach through registrations.
 */
export async function POST() {
  try {
    const user = await authServer.requireAdmin();
    const orgId = await getAdminOrgId(user.id);

    // Listing auth users needs the service-role key
    const supabase = createAdminClient();
    const authUsers: AuthUser[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      if (error) {
        return sendApiError(500, 'AUTH_LIST_FAILED', 'Failed to fetch auth users');
      }
      authUsers.push(...data.users);
      if (data.users.length < PAGE_SIZE) break;
    }

    const authIds = authUsers.map((u) => u.id);
    const existing =
      authIds.length > 0
        ? await db
            .select({ id: users.id, role: users.role, organizationId: users.organizationId })
            .from(users)
            .where(inArray(users.id, authIds))
        : [];
    const existingById = new Map(existing.map((u) => [u.id, u]));

    const missing = authUsers.filter((u) => u.email && !existingById.has(u.id));

    // The latest invitation per email decides the role, whatever its status
    const missingEmails = missing.map((u) => u.email!.toLowerCase());
    const invitedRoles = new Map<string, SyncableRole>();
    if (missingEmails.length > 0) {
      const rows = await db
        .select({ email: invitations.email, role: invitations.role })
        .from(invitations)
        .where(inArray(sql`lower(${invitations.email})`, missingEmails))
        .orderBy(desc(invitations.createdAt));
      for (const row of rows) {
        const key = row.email.toLowerCase();
        if (!invitedRoles.has(key)) invitedRoles.set(key, row.role);
      }
    }

    const results = [];
    for (const authUser of authUsers) {
      if (!authUser.email) continue;

      const current = existingById.get(authUser.id);
      if (current) {
        results.push({
          id: authUser.id,
          email: authUser.email,
          action: 'exists',
          role: current.role,
          organizationId: current.organizationId,
        });
        continue;
      }

      const metadataRole = authUser.user_metadata?.role;
      const role: SyncableRole =
        invitedRoles.get(authUser.email.toLowerCase()) ??
        (isSyncableRole(metadataRole) ? metadataRole : 'judge');

      try {
        await db.transaction(async (tx) => {
          await tx.insert(users).values({
            id: authUser.id,
            email: authUser.email!,
            role,
            organizationId: role === 'admin' ? orgId : null,
          });
          if (role === 'judge') {
            await tx
              .insert(organizationMembers)
              .values({ organizationId: orgId, userId: authUser.id })
              .onConflictDoNothing();
          }
        });
        results.push({
          id: authUser.id,
          email: authUser.email,
          action: 'created',
          role,
          organizationId: orgId,
        });
      } catch (error) {
        results.push({
          id: authUser.id,
          email: authUser.email,
          action: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    return handleRouteError(error, 'Error syncing users');
  }
}
