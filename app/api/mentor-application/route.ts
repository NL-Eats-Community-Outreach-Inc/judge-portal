// Placeholder for testing
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = await req.text();
  }

  console.log(body);

  return NextResponse.json({ ok: true });
}
