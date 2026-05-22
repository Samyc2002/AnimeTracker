import { getWatchUrl } from '../stream-provider';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('getWatchUrl', () => {
  it('returns WatchURLs when API responds with both URLs', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url9anime: 'https://9anime.org.lv/naruto',
        urlKickass: 'https://anikoto.cz/naruto',
      }),
    });

    const result = await getWatchUrl('Naruto');
    expect(result).toEqual({
      url9anime: 'https://9anime.org.lv/naruto',
      urlKickass: 'https://anikoto.cz/naruto',
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/stream?title=Naruto');
  });

  it('returns null when API returns non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

    const result = await getWatchUrl('Fail');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await getWatchUrl('Error');
    expect(result).toBeNull();
  });

  it('encodes special characters in the title', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url9anime: 'https://9anime.org.lv/re-zero',
        urlKickass: 'https://kickassanime.com.es/re-zero',
      }),
    });

    await getWatchUrl('Re:Zero');
    expect(global.fetch).toHaveBeenCalledWith('/api/stream?title=Re%3AZero');
  });
});
