import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ANIMEKAI_BASE = 'https://animekai.to';
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get('title');

  if (!title) {
    return NextResponse.json({ error: 'Missing title' }, { status: 400 });
  }

  try {
    const searchUrl = `${ANIMEKAI_BASE}/browser?keyword=${encodeURIComponent(title)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': AGENT, 'Referer': ANIMEKAI_BASE },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Search failed' }, { status: 502 });
    }

    const html = await res.text();
    const matches = [...html.matchAll(/href="\/watch\/([^"]*)"/g)];
    if (matches.length === 0) {
      return NextResponse.json({ error: 'No results found', url: null });
    }

    const slug = matches[0][1];
    return NextResponse.json({ url: `${ANIMEKAI_BASE}/watch/${slug}` });
  } catch {
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
