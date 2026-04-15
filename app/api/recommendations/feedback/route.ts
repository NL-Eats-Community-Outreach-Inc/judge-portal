// app/api/recommendations/feedback/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  // Log it to your terminal to see the data arriving
  console.log('Feedback Received:', body);

  // Simulate a success response
  return NextResponse.json({ message: 'Feedback received' }, { status: 200 });
}
