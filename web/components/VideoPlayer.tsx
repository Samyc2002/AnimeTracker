'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import type { StreamSource, SubtitleTrack } from '@/lib/stream-provider';

interface VideoPlayerProps {
  sources: StreamSource[];
  onEnded?: () => void;
}

export default function VideoPlayer({ sources, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [selectedQuality, setSelectedQuality] = useState(0);
  const [error, setError] = useState(false);

  const current = sources[selectedQuality];
  const subtitles: SubtitleTrack[] = current?.subtitles || [];

  const attachSource = useCallback(() => {
    const video = videoRef.current;
    if (!video || !current) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setError(false);
    const time = video.currentTime;

    if (current.url.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(current.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.currentTime = time;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError(true);
      });
    } else if (current.url.includes('.m3u8') && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = current.url;
      video.currentTime = time;
    } else {
      video.src = current.url;
      video.currentTime = time;
    }
  }, [current]);

  useEffect(() => {
    attachSource();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [attachSource]);

  if (sources.length === 0) {
    return (
      <div className="w-full aspect-video bg-[#0a0a1a] rounded-lg flex flex-col items-center justify-center gap-3">
        <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-400 text-sm font-medium">Install the Chrome extension to watch</p>
        <p className="text-gray-600 text-xs max-w-sm text-center">
          The Anime Tracker extension resolves streams locally so you can watch directly in the browser.
        </p>
        <a
          href="https://chromewebstore.google.com/detail/anime-tracker"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          Get the Extension
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-red-400 text-sm">Failed to load video</p>
            <button
              onClick={() => attachSource()}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Retry
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full h-full"
            onEnded={onEnded}
            onError={() => {
              if (!hlsRef.current) setError(true);
            }}
          >
            {subtitles.map((sub) => (
              <track
                key={sub.lang}
                kind="subtitles"
                src={sub.url}
                srcLang={sub.lang}
                label={sub.label}
              />
            ))}
          </video>
        )}
      </div>

      {(sources.length > 1 || subtitles.length > 0) && (
        <div className="flex items-center gap-4 mt-2">
          {sources.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Quality:</span>
              <select
                value={selectedQuality}
                onChange={(e) => setSelectedQuality(Number(e.target.value))}
                className="text-xs bg-[#16213e] border border-[#3a3a5c] rounded px-2 py-1 text-gray-300 outline-none"
              >
                {sources.map((s, i) => (
                  <option key={i} value={i}>{s.quality}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
