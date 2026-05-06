import { render, fireEvent, waitFor } from '@testing-library/react';
import AddToWatchlist from '@/components/AddToWatchlist';
import { enqueueSnackbar } from 'notistack';
import type { AniListMedia } from '@/lib/types';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();

function chainBuilder(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    eq: mockEq,
    limit: mockLimit,
    single: mockSingle,
    then: undefined,
    ...overrides,
  };
  for (const fn of [mockSelect, mockInsert, mockUpdate, mockEq, mockLimit, mockSingle]) {
    fn.mockReturnValue(chain);
  }
  return chain;
}

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/lib/anime-provider', () => ({
  mediaToWatchlistEntry: vi.fn(() => ({
    media_id: 1,
    title_romaji: 'Test',
    cover_url: '',
    status: 'RELEASING',
    total_episodes: 12,
    next_airing_episode: null,
    next_airing_at: null,
    watch_status: 'Watching',
    is_adult: false,
    id_mal: null,
    series_id: null,
  })),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong',
  ),
}));

vi.mock('@/lib/series-resolver', () => ({
  backfillSeriesId: vi.fn().mockResolvedValue(undefined),
}));

const testMedia: AniListMedia = {
  id: 1,
  idMal: null,
  title: { romaji: 'Test Anime', english: 'Test Anime' },
  coverImage: { extraLarge: '', large: '', medium: '' },
  status: 'RELEASING' as const,
  episodes: 12,
  isAdult: false,
  nextAiringEpisode: null,
};

describe('AddToWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user1', email: 'test@test.com' } } });
  });

  it('shows "+ Add" button when anime is not in watchlist', async () => {
    const chain = chainBuilder();
    chain.then = (_resolve: (v: unknown) => void) => {
      _resolve({ data: [], error: null });
      return { catch: () => {} };
    };
    mockFrom.mockReturnValue(chain);

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });
  });

  it('shows current status when anime is already in watchlist', async () => {
    const chain = chainBuilder();
    chain.then = (_resolve: (v: unknown) => void) => {
      _resolve({ data: [{ id: 'doc1', watch_status: 'Completed' }], error: null });
      return { catch: () => {} };
    };
    mockFrom.mockReturnValue(chain);

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('Completed')).toBeInTheDocument();
    });
  });

  it('opens dropdown with 4 status options on click', async () => {
    const chain = chainBuilder();
    chain.then = (_resolve: (v: unknown) => void) => {
      _resolve({ data: [], error: null });
      return { catch: () => {} };
    };
    mockFrom.mockReturnValue(chain);

    const { getByText, getAllByRole } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });

    fireEvent.click(getByText('+ Add'));

    const statusButtons = getAllByRole('button').filter((btn) =>
      ['Watching', 'Planned', 'Completed', 'Dropped'].includes(btn.textContent ?? ''),
    );
    expect(statusButtons).toHaveLength(4);
  });
});
