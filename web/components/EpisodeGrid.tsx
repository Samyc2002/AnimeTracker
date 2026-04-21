'use client';

interface EpisodeGridProps {
  totalEpisodes: number;
  watchedEpisodes: number[];
  onToggle: (episode: number) => void;
}

export default function EpisodeGrid({ totalEpisodes, watchedEpisodes, onToggle }: EpisodeGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
      {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
        const isWatched = watchedEpisodes.includes(ep);
        return (
          <button
            key={ep}
            onClick={() => onToggle(ep)}
            className={`h-9 rounded text-sm font-semibold transition-colors ${
              isWatched
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-[#2a2a4a] text-gray-500 hover:bg-[#3a3a6a]'
            }`}
          >
            {ep}
          </button>
        );
      })}
    </div>
  );
}
