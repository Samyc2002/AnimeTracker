import { getWatchUrl } from '@/lib/stream-provider';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('getWatchUrl', () => {
  it('returns the URL on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/watch/naruto' }),
      }),
    );

    const result = await getWatchUrl('Naruto');

    expect(result).toBe('https://example.com/watch/naruto');
    expect(fetch).toHaveBeenCalledWith('/api/stream?title=Naruto');
  });

  it('returns null on a non-200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    );

    const result = await getWatchUrl('Unknown Anime');
    expect(result).toBeNull();
  });

  it('returns null on a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const result = await getWatchUrl('Broken');
    expect(result).toBeNull();
  });

  it('returns null when response data has no url field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ something: 'else' }),
      }),
    );

    const result = await getWatchUrl('No URL');
    expect(result).toBeNull();
  });

  it('encodes the title in the query string', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://example.com/watch' }),
      }),
    );

    await getWatchUrl('My Hero Academia');
    expect(fetch).toHaveBeenCalledWith('/api/stream?title=My%20Hero%20Academia');
  });
});
