import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    error: 'Streaming is handled by the Anime Tracker Chrome extension. Install it to watch anime.',
    sources: [],
  });
}
