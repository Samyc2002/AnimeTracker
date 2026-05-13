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

  it('returns 9anime and kickass URLs when both searches succeed', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<a href="/anime/naruto-shippuden/" itemprop="url">Naruto</a><a href="/anime/naruto/" itemprop="url">Naruto</a>',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<a href="/anime/naruto-shippuden/" itemprop="url">Naruto</a><a href="/anime/naruto/" itemprop="url">Naruto</a>',
      });

    const req = new NextRequest(
      new URL('http://localhost/api/stream?title=Naruto')
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url9anime).toBe('https://9anime.org.lv/naruto');
    expect(body.urlKickass).toBe('https://kickassanime.com.es//naruto');
  });

  it('returns error when 9anime search returns no matches', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: async () => '<html><body>No results</body></html>',
    });

    const req = new NextRequest(
      new URL('http://localhost/api/stream?title=NonexistentAnime')
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeNull();
    expect(body.error).toBe('No results found');
  });

  it('returns 502 when upstream fetch is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 });

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
