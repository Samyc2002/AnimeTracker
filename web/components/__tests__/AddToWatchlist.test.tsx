import { render, fireEvent, waitFor } from '@testing-library/react';
import AddToWatchlist from '@/components/AddToWatchlist';
import { account, databases } from '@/lib/appwrite';
import { enqueueSnackbar } from 'notistack';
import type { AniListMedia } from '@/lib/types';

vi.mock('@/lib/appwrite', () => ({
  account: { get: vi.fn() },
  databases: { listDocuments: vi.fn(), createDocument: vi.fn(), updateDocument: vi.fn() },
  DATABASE_ID: 'test-db',
  WATCHLIST_COLLECTION_ID: 'test-watchlist',
}));

vi.mock('@/lib/anilist', () => ({
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
  })),
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong',
  ),
}));

vi.mock('appwrite', () => ({
  ID: { unique: vi.fn(() => 'unique-id') },
  Query: {
    equal: vi.fn((field: string, value: unknown) => `${field}=${value}`),
    limit: vi.fn((n: number) => `limit=${n}`),
  },
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
  });

  it('shows "+ Add" button when anime is not in watchlist', async () => {
    (account.get as ReturnType<typeof vi.fn>).mockResolvedValue({ $id: 'user1' });
    (databases.listDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      documents: [],
      total: 0,
    });

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });
  });

  it('shows current status when anime is already in watchlist', async () => {
    (account.get as ReturnType<typeof vi.fn>).mockResolvedValue({ $id: 'user1' });
    (databases.listDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      documents: [{ $id: 'doc1', watch_status: 'Completed' }],
      total: 1,
    });

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('Completed')).toBeInTheDocument();
    });
  });

  it('opens dropdown with 4 status options on click', async () => {
    (account.get as ReturnType<typeof vi.fn>).mockResolvedValue({ $id: 'user1' });
    (databases.listDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      documents: [],
      total: 0,
    });

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

  it('calls createDocument on add and shows snackbar', async () => {
    (account.get as ReturnType<typeof vi.fn>).mockResolvedValue({ $id: 'user1' });
    (databases.listDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      documents: [],
      total: 0,
    });
    (databases.createDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      $id: 'new-doc',
    });

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('+ Add')).toBeInTheDocument();
    });

    fireEvent.click(getByText('+ Add'));
    fireEvent.click(getByText('Watching'));

    await waitFor(() => {
      expect(databases.createDocument).toHaveBeenCalledWith(
        'test-db',
        'test-watchlist',
        'unique-id',
        expect.objectContaining({
          user_id: 'user1',
          watch_status: 'Watching',
        }),
      );
    });

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('Added as Watching', { variant: 'success' });
    });
  });

  it('calls updateDocument on status change and shows snackbar', async () => {
    (account.get as ReturnType<typeof vi.fn>).mockResolvedValue({ $id: 'user1' });
    (databases.listDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      documents: [{ $id: 'doc1', watch_status: 'Watching' }],
      total: 1,
    });
    (databases.updateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      $id: 'doc1',
    });

    const { getByText } = render(<AddToWatchlist media={testMedia} />);

    await waitFor(() => {
      expect(getByText('Watching')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Watching'));

    const droppedOption = getByText((content) => content.includes('Dropped'));
    fireEvent.click(droppedOption);

    await waitFor(() => {
      expect(databases.updateDocument).toHaveBeenCalledWith(
        'test-db',
        'test-watchlist',
        'doc1',
        { watch_status: 'Dropped' },
      );
    });

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('Status changed to Dropped', {
        variant: 'success',
      });
    });
  });
});
