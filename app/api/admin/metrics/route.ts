import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth/server';

export async function GET() {
  try {
    const user = await getUserFromSession();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const metrics = {
      totalRecommendationRequests: 0,
      mostFrequentlyRecommendedItems: [],
      totalLearnersServed: 0,
      averageResponseTime: 0,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
