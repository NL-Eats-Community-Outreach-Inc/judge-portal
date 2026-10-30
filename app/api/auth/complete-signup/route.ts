import { NextResponse } from 'next/server';
import { authServer } from '@/lib/auth';
import { completeSignup } from '@/lib/auth/complete-signup';

export async function POST() {
  try {
    const user = await authServer.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await completeSignup(user.id, user.email, user.user_metadata ?? {});

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to complete signup:', error);

    return NextResponse.json({ error: 'Failed to complete account setup' }, { status: 500 });
  }
}
