import { createClient as createServerClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'admin' | 'judge' | 'participant';

// Export invitation utilities
export * from './invitation';

export interface UserWithRole extends User {
  role?: UserRole;
  organizationId?: string | null;
}

// Server-side authentication utilities
export const authServer = {
  async getUser() {
    const supabase = await createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    // Get user role and org from our users table
    const userRecord = await db
      .select({ role: users.role, organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    return {
      ...user,
      role: userRecord[0]?.role as UserRole,
      organizationId: userRecord[0]?.organizationId as string | null,
    };
  },

  async requireAuth() {
    const user = await this.getUser();
    if (!user) {
      throw new Error('Authentication required');
    }
    return user;
  },

  async requireRole(requiredRole: UserRole) {
    const user = await this.requireAuth();
    if (user.role !== requiredRole) {
      throw new Error(`${requiredRole} role required`);
    }
    return user;
  },

  async requireAdmin() {
    return await this.requireRole('admin');
  },

  async requireJudge() {
    return await this.requireRole('judge');
  },

  async requireSuperAdmin() {
    return await this.requireRole('super_admin');
  },

  async requireParticipant() {
    return await this.requireRole('participant');
  },
};
