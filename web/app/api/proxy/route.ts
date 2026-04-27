import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const referer = req.nextUrl.searchParams.get('referer');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    };
    if (referer) headers['Referer'] = referer;

    const upstream = await fetch(url, { headers });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new NextResponse('Proxy fetch failed', { status: 502 });
  }
}
