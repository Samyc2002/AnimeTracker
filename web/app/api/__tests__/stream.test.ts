import { NextRequest } from 'next/server';
import { GET } from '../stream/route';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('GET /api/stream', () => {
  it('returns 400 for missing title', async () => {
    const req = new NextRequest(new URL('http://localhost/api/stream'));
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing title');
  });

  it('returns correct URL when HTML contains a watch link', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<a href="/watch/test-slug">Watch</a>',
    });

    const req = new NextRequest(
      new URL('http://localhost/api/stream?title=My+Anime')
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://animekai.to/watch/test-slug');
  });

  it('returns null URL when no matches in HTML', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<html><body>No links here</body></html>',
    });

    const req = new NextRequest(
      new URL('http://localhost/api/stream?title=Nothing')
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeNull();
    expect(body.error).toBe('No results found');
  });

  it('returns 502 when upstream fetch is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    const req = new NextRequest(
      new URL('http://localhost/api/stream?title=Fail')
    );
    const res = await GET(req);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Search failed');
  });

  it('returns 500 when fetch throws an exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const req = new NextRequest(
      new URL('http://localhost/api/stream?title=Error')
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to search');
  });
});
