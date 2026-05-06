import { NextRequest } from 'next/server';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

function makeChain(resolveValue: unknown = { data: [], error: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'gt', 'limit', 'range', 'order', 'single', 'in']) {
    chain[m] = vi.fn(() => chain);
  }
  (chain as { then: unknown }).then = (cb: (v: unknown) => void) => {
    const result = cb(resolveValue);
    return { catch: vi.fn(() => result) };
  };
  Object.assign(chain, resolveValue);
  return chain;
}

const originalFetch = global.fetch;

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  global.fetch = originalFetch;

  const mod = await import('../notifications/poll/route');
  POST = mod.POST;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('POST /api/notifications/poll', () => {
  it('returns 400 for missing userId', async () => {
    const req = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Missing userId');
  });

  it('returns cached response on repeated calls within cooldown', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

    const req1 = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user1' }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.created).toBe(0);

    const req2 = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user1' }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.cached).toBe(true);
  });

  it('creates notifications for new episodes', async () => {
    const now = Math.floor(Date.now() / 1000);

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({ data: [{ media_id: 100, title_english: 'Test Anime', title_romaji: 'Test JP', cover_url: 'img.jpg' }], error: null });
      }
      return makeChain({ data: [], error: null });
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          Page: {
            airingSchedules: [
              { mediaId: 100, episode: 5, airingAt: now - 3600 },
            ],
          },
        },
      }),
    });

    const req = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
  });
});
