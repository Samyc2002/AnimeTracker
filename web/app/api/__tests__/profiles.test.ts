import { NextRequest } from 'next/server';

const mockListDocuments = vi.fn();

vi.mock('node-appwrite', () => {
  class MockClient {
    setEndpoint() { return this; }
    setProject() { return this; }
    setKey() { return this; }
  }
  class MockDatabases {
    listDocuments = mockListDocuments;
  }
  return {
    Client: MockClient,
    Databases: MockDatabases,
    Query: {
      equal: (...args: unknown[]) => args,
      select: (...args: unknown[]) => args,
      limit: (n: number) => n,
    },
  };
});

import { GET } from '../profiles/[username]/route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test-project';
  process.env.APPWRITE_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID = 'test-db';
  process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID = 'profiles';
  process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID = 'watchlist';
  process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID = 'watched';
});

describe('GET /api/profiles/[username]', () => {
  it('returns 404 when profile not found', async () => {
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    const req = new NextRequest(
      new URL('http://localhost/api/profiles/nobody')
    );
    const res = await GET(req, {
      params: Promise.resolve({ username: 'nobody' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Profile not found');
  });

  it('returns profile data when found', async () => {
    // Profile query
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        {
          user_id: 'u1',
          username: 'testuser',
          display_name: 'Test User',
          is_public: true,
          hide_nsfw_public: false,
          $createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    // Watchlist entries query
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        {
          media_id: 100,
          title_romaji: 'Anime One',
          title_english: 'Anime One EN',
          cover_url: 'https://img.example.com/100.jpg',
          status: 'RELEASING',
          total_episodes: 12,
          watch_status: 'Watching',
          is_adult: false,
        },
      ],
    });

    // Watched episodes query
    mockListDocuments.mockResolvedValueOnce({
      total: 5,
      documents: [
        { media_id: 100 },
        { media_id: 100 },
        { media_id: 100 },
        { media_id: 100 },
        { media_id: 100 },
      ],
    });

    const req = new NextRequest(
      new URL('http://localhost/api/profiles/testuser')
    );
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
    // Profile with hide_nsfw_public enabled
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        {
          user_id: 'u2',
          username: 'safeuser',
          display_name: null,
          is_public: true,
          hide_nsfw_public: true,
          $createdAt: '2024-06-01T00:00:00.000Z',
        },
      ],
    });

    // Watchlist with one SFW and one NSFW entry
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        {
          media_id: 200,
          title_romaji: 'Safe Anime',
          title_english: 'Safe Anime EN',
          cover_url: 'https://img.example.com/200.jpg',
          status: 'FINISHED',
          total_episodes: 24,
          watch_status: 'Completed',
          is_adult: false,
        },
        {
          media_id: 201,
          title_romaji: 'NSFW Anime',
          title_english: 'NSFW Anime EN',
          cover_url: 'https://img.example.com/201.jpg',
          status: 'FINISHED',
          total_episodes: 12,
          watch_status: 'Completed',
          is_adult: true,
        },
      ],
    });

    // Watched episodes
    mockListDocuments.mockResolvedValueOnce({
      total: 30,
      documents: [],
    });

    const req = new NextRequest(
      new URL('http://localhost/api/profiles/safeuser')
    );
    const res = await GET(req, {
      params: Promise.resolve({ username: 'safeuser' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Only the SFW entry should remain
    expect(body.watchlist).toHaveLength(1);
    expect(body.watchlist[0].media_id).toBe(200);
    expect(body.stats.total_anime).toBe(1);
  });
});
