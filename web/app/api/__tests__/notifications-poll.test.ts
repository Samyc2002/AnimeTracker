import { NextRequest } from 'next/server';

const mockListDocuments = vi.fn();
const mockCreateDocument = vi.fn();

vi.mock('node-appwrite', () => {
  class MockClient {
    setEndpoint() { return this; }
    setProject() { return this; }
    setKey() { return this; }
  }
  class MockDatabases {
    listDocuments = mockListDocuments;
    createDocument = mockCreateDocument;
  }
  return {
    Client: MockClient,
    Databases: MockDatabases,
    Query: {
      equal: (...args: unknown[]) => args,
      greaterThan: (...args: unknown[]) => args,
      limit: (n: number) => n,
    },
    ID: { unique: () => 'unique-id' },
  };
});

const originalFetch = global.fetch;

let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  global.fetch = originalFetch;

  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT = 'https://test.appwrite.io/v1';
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = 'test-project';
  process.env.APPWRITE_API_KEY = 'test-key';
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID = 'test-db';
  process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID = 'watchlist';
  process.env.NEXT_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION_ID = 'notifications';

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
    // First call: user has no watchlist entries
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    const req1 = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user1' }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.created).toBe(0);

    // Second call: should hit cache
    const req2 = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user1' }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.cached).toBe(true);
    expect(body2.created).toBe(0);
  });

  it('creates notifications for new episodes', async () => {
    const now = Math.floor(Date.now() / 1000);

    // Watchlist query
    mockListDocuments.mockResolvedValueOnce({
      documents: [
        {
          media_id: 100,
          title_english: 'Test Anime',
          title_romaji: 'Test Anime JP',
          cover_url: 'https://img.example.com/100.jpg',
        },
      ],
    });

    // Mock AniList fetch
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

    // Existing notifications query (none)
    mockListDocuments.mockResolvedValueOnce({ documents: [] });

    // createDocument succeeds
    mockCreateDocument.mockResolvedValueOnce({});

    const req = new NextRequest('http://localhost/api/notifications/poll', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user2' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(1);
    expect(mockCreateDocument).toHaveBeenCalledTimes(1);
    expect(mockCreateDocument).toHaveBeenCalledWith(
      'test-db',
      'notifications',
      'unique-id',
      expect.objectContaining({
        user_id: 'user2',
        media_id: 100,
        episode: 5,
        title: 'Test Anime',
      })
    );
  });
});
