// Used for testing for the rec-widget.tsx -- IC-24
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  console.log('Feedback Received:', body);

  return NextResponse.json({ message: 'Feedback received' }, { status: 200 });
}
