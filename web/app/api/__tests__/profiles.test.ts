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
  Object.assign(chain, resolveValue);
  return chain;
}

import { GET } from '../profiles/[username]/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/profiles/[username]', () => {
  it('returns 404 when profile not found', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

    const req = new NextRequest(new URL('http://localhost/api/profiles/nobody'));
    const res = await GET(req, {
      params: Promise.resolve({ username: 'nobody' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Profile not found');
  });

  it('returns profile data when found', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          data: [{
            user_id: 'u1', username: 'testuser', display_name: 'Test User',
            is_public: true, hide_nsfw_public: false, created_at: '2024-01-01T00:00:00.000Z',
            avatar: null, social_twitter: null, social_discord: null, social_instagram: null, social_reddit: null,
          }],
          error: null,
        });
      }
      if (callCount === 2) {
        return makeChain({
          data: [{
            media_id: 100, title_romaji: 'Anime One', title_english: 'Anime One EN',
            cover_url: 'https://img.example.com/100.jpg', status: 'RELEASING',
            total_episodes: 12, watch_status: 'Watching', is_adult: false, manual_nsfw: false,
          }],
          error: null,
        });
      }
      if (callCount === 3) {
        return makeChain({
          data: [{ media_id: 100 }, { media_id: 100 }, { media_id: 100 }, { media_id: 100 }, { media_id: 100 }],
          error: null, count: 5,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const req = new NextRequest(new URL('http://localhost/api/profiles/testuser'));
    const res = await GET(req, {
      params: Promise.resolve({ username: 'testuser' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.username).toBe('testuser');
    expect(body.display_name).toBe('Test User');
    expect(body.watchlist).toHaveLength(1);
    expect(body.watchlist[0].media_id).toBe(100);
    expect(body.watchlist[0].episodes_watched).toBe(5);
    expect(body.stats.total_anime).toBe(1);
    expect(body.stats.watching).toBe(1);
  });

  it('filters NSFW entries when hide_nsfw_public is true', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          data: [{
            user_id: 'u2', username: 'safeuser', display_name: null,
            is_public: true, hide_nsfw_public: true, created_at: '2024-06-01T00:00:00.000Z',
            avatar: null, social_twitter: null, social_discord: null, social_instagram: null, social_reddit: null,
          }],
          error: null,
        });
      }
      if (callCount === 2) {
        return makeChain({
          data: [
            { media_id: 200, title_romaji: 'Safe', title_english: 'Safe EN', cover_url: '', status: 'FINISHED', total_episodes: 24, watch_status: 'Completed', is_adult: false, manual_nsfw: false },
            { media_id: 201, title_romaji: 'NSFW', title_english: 'NSFW EN', cover_url: '', status: 'FINISHED', total_episodes: 12, watch_status: 'Completed', is_adult: true, manual_nsfw: false },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null, count: 0 });
    });

    const req = new NextRequest(new URL('http://localhost/api/profiles/safeuser'));
    const res = await GET(req, {
      params: Promise.resolve({ username: 'safeuser' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.watchlist).toHaveLength(1);
    expect(body.watchlist[0].media_id).toBe(200);
    expect(body.stats.total_anime).toBe(1);
  });
});
