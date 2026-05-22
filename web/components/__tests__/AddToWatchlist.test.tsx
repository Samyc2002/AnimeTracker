import { render, fireEvent, waitFor } from '@testing-library/react';
import AddToWatchlist from '@/components/AddToWatchlist';
import { supabase } from '@/lib/supabase';
import { enqueueSnackbar } from 'notistack';
import type { AniListMedia } from '@/lib/types';

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(() => ({ authed: true, loading: false, userId: 'user1', userEmail: 'test@test.com' })),
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

vi.mock('@/lib/series-metadata', () => ({
  upsertSeriesMetadata: vi.fn().mockResolvedValue(undefined),
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

function mockSupabaseChain(data: unknown[] = [], error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'limit', 'single', 'upsert']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.select.mockReturnValue({ ...chain, data, error });
  chain.eq.mockReturnValue({ ...chain, data, error });
  chain.limit.mockReturnValue({ ...chain, data, error });
  chain.single.mockReturnValue({ ...chain, data: data[0] || null, error });
  chain.insert.mockReturnValue({ ...chain, data: data[0] || null, error });
  return chain;
}

describe('AddToWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "+ Add" button when anime is not in watchlist', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseChain([]));

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });
  });

  it('shows current status when anime is already in watchlist', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSupabaseChain([{ id: 'doc1', watch_status: 'Completed' }])
    );

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('Completed')).toBeInTheDocument();
    });
  });

  it('opens dropdown with 4 status options on click', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseChain([]));

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

  it('calls insert on add and shows snackbar', async () => {
    const insertChain = mockSupabaseChain([{ id: 'new-doc' }]);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseChain([]));

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    fireEvent.click(getByText('+ Add'));
    fireEvent.click(getByText('Watching'));

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('Added as Watching', { variant: 'success' });
    });
  });

  it('calls update on status change and shows snackbar', async () => {
    const updateChain = mockSupabaseChain([{ id: 'doc1' }]);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSupabaseChain([{ id: 'doc1', watch_status: 'Watching' }])
    );

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('Watching')).toBeInTheDocument();
    });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    fireEvent.click(getByText('Watching'));

    const droppedOption = getByText((content) => content.includes('Dropped'));
    fireEvent.click(droppedOption);

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('Status changed to Dropped', { variant: 'success' });
    });
  });

  it('blocks double-clicks while updating', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseChain([]));

    const { getByText, queryByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });

    const insertChain = mockSupabaseChain([{ id: 'new-doc' }]);
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    fireEvent.click(getByText('+ Add'));
    fireEvent.click(getByText('Watching'));

    // Dropdown should close immediately
    await waitFor(() => {
      expect(queryByText('Planned')).not.toBeInTheDocument();
    });
  });

  it('falls back to id_mal lookup when media_id query returns empty', async () => {
    const mediaWithMal = { ...testMedia, idMal: 999 };
    (supabase.from as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(mockSupabaseChain([]))
      .mockReturnValueOnce(mockSupabaseChain([{ id: 'mal-doc', watch_status: 'Planned' }]));

    const { getByText } = render(<AddToWatchlist media={mediaWithMal} />);

    await waitFor(() => {
      expect(getByText('Planned')).toBeInTheDocument();
    });
  });

  it('shows default status when watch_status is undefined', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      mockSupabaseChain([{ id: 'doc1', watch_status: undefined }])
    );

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('Watching')).toBeInTheDocument();
    });
  });

  it('shows error snackbar when insert fails', async () => {
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabaseChain([]));

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });

    const errorChain = mockSupabaseChain([], { message: 'Insert failed', code: '23505' });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(errorChain);

    fireEvent.click(getByText('+ Add'));
    fireEvent.click(getByText('Watching'));

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.any(String), { variant: 'error' });
    });
  });
});
