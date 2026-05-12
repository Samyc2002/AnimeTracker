import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ALLOWED_HOSTNAMES = new Set<string>([
  'example.com',
  'cdn.example.com',
]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const referer = req.nextUrl.searchParams.get('referer');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return new NextResponse('Invalid url parameter', { status: 400 });
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return new NextResponse('Unsupported URL protocol', { status: 400 });
  }

  if (!ALLOWED_HOSTNAMES.has(targetUrl.hostname)) {
    return new NextResponse('Target host is not allowed', { status: 403 });
  }

  if (targetUrl.username || targetUrl.password) {
    return new NextResponse('URL credentials are not allowed', { status: 400 });
  }

  if (targetUrl.port && !['80', '443'].includes(targetUrl.port)) {
    return new NextResponse('Target port is not allowed', { status: 403 });
  }

  const normalizedPathSegments = targetUrl.pathname.split('/').filter(Boolean);
  if (normalizedPathSegments.some((segment) => segment === '.' || segment === '..')) {
    return new NextResponse('Invalid URL path', { status: 400 });
  }

  const safeTargetUrl = new URL(`${targetUrl.protocol}//${targetUrl.hostname}${targetUrl.pathname}${targetUrl.search}`);

  try {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    };

    if (referer) {
      try {
        const refererUrl = new URL(referer);
        if (['http:', 'https:'].includes(refererUrl.protocol)) {
          headers['Referer'] = refererUrl.toString();
        }
      } catch {
        // Ignore invalid referer values.
      }
    }

    const upstream = await fetch(safeTargetUrl.toString(), {
      headers,
      cache: 'no-store',
      redirect: 'error',
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Proxy fetch failed', { status: 502 });
  }
}
