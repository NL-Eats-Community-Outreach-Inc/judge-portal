/**
 * Admin Metrics Endpoint
 * GET /api/admin/metrics
 *
 * Returns aggregated analytics data for administrative use.
 * Access is restricted to users with the admin role.
 */

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const user = await getUserFromSession();

    // Only admins can access this endpoint
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query total learners (participants)
    const learners = await db.select().from(users).where(eq(users.role, 'participant'));

    // TODO: Replace placeholder metrics with real analytics queries from the database
    const metrics = {
      totalRecommendationRequests: 0,
      mostFrequentlyRecommendedItems: [],
      totalLearnersServed: learners.length,
      averageResponseTime: 0,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}