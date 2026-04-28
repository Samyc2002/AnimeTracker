beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.resetModules();
});

describe('online-tracker', () => {
  it('returns 1 after a single heartbeat', async () => {
    const { recordHeartbeat, getOnlineCount } = await import('@/lib/online-tracker');

    recordHeartbeat('user-1');
    expect(getOnlineCount()).toBe(1);
  });

  it('counts multiple distinct users', async () => {
    const { recordHeartbeat, getOnlineCount } = await import('@/lib/online-tracker');

    recordHeartbeat('user-1');
    recordHeartbeat('user-2');
    recordHeartbeat('user-3');
    expect(getOnlineCount()).toBe(3);
  });

  it('does not double-count the same user', async () => {
    const { recordHeartbeat, getOnlineCount } = await import('@/lib/online-tracker');

    recordHeartbeat('user-1');
    recordHeartbeat('user-1');
    expect(getOnlineCount()).toBe(1);
  });

  it('cleans up expired entries after 5 minutes', async () => {
    vi.useFakeTimers();

    const { recordHeartbeat, getOnlineCount } = await import('@/lib/online-tracker');

    recordHeartbeat('user-1');
    expect(getOnlineCount()).toBe(1);

    // Advance time by 6 minutes (past the 5-min expiry)
    vi.advanceTimersByTime(6 * 60 * 1000);

    expect(getOnlineCount()).toBe(0);

    vi.useRealTimers();
  });

  it('keeps fresh entries and removes only expired ones', async () => {
    vi.useFakeTimers();

    const { recordHeartbeat, getOnlineCount } = await import('@/lib/online-tracker');

    recordHeartbeat('user-1');

    // Advance 4 minutes — user-1 still valid
    vi.advanceTimersByTime(4 * 60 * 1000);
    recordHeartbeat('user-2');

    // Advance 2 more minutes — user-1 is now 6 min old (expired), user-2 is 2 min old (fresh)
    vi.advanceTimersByTime(2 * 60 * 1000);

    expect(getOnlineCount()).toBe(1);

    vi.useRealTimers();
  });
});
