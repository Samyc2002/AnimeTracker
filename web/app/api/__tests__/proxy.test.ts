import { NextRequest } from 'next/server';
import { GET } from '../proxy/route';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('GET /api/proxy', () => {
  it('returns 400 for missing url', async () => {
    const req = new NextRequest(new URL('http://localhost/api/proxy'));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toBe('Missing url parameter');
  });

  it('proxies response with correct headers', async () => {
    const mockBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hello'));
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    });

    const req = new NextRequest(
      new URL('http://localhost/api/proxy?url=https://example.com/page')
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('passes referer header when provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    const req = new NextRequest(
      new URL(
        'http://localhost/api/proxy?url=https://example.com&referer=https://referer.com'
      )
    );
    await GET(req);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({
        headers: expect.objectContaining({ Referer: 'https://referer.com/' }),
      })
    );
  });

  it('returns upstream status on error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const req = new NextRequest(
      new URL('http://localhost/api/proxy?url=https://example.com/blocked')
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toBe('Upstream error: 403');
  });

  it('returns 502 on fetch exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const req = new NextRequest(
      new URL('http://localhost/api/proxy?url=https://example.com/down')
    );
    const res = await GET(req);
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toBe('Proxy fetch failed');
  });
});
