export interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
}

export interface StreamSource {
  url: string;
  quality: string;
  subtitles?: SubtitleTrack[];
}

export function isExtensionAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(false);
    }, 2000);

    function handler(event: MessageEvent) {
      if (event.data?.type === 'ANIME_EXTENSION_READY') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(true);
      }
    }
    window.addEventListener('message', handler);
  });
}

export async function getEpisodeStream(
  _malId: number | null,
  _anilistId: number,
  episode: number,
  title: string,
  mode: string = 'sub',
): Promise<StreamSource[]> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve([]);
    }, 15000);

    function handler(event: MessageEvent) {
      if (event.data?.type !== 'ANIME_STREAM_RESPONSE') return;
      console.log('[Stream Provider] Got ANIME_STREAM_RESPONSE:', event.data);
      clearTimeout(timeout);
      window.removeEventListener('message', handler);

      const sources: StreamSource[] = (event.data.sources || []).map(
        (s: { url: string; quality: string; referer?: string }) => ({
          url: s.url,
          quality: s.quality,
        })
      );
      resolve(sources);
    }

    window.addEventListener('message', handler);
    console.log('[Stream Provider] Sending ANIME_STREAM_REQUEST:', { title, episode, mode });
    window.postMessage({
      type: 'ANIME_STREAM_REQUEST',
      title,
      episode,
      mode,
    });
  });
}
