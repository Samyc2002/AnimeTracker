# Streaming Architecture

## Overview

The streaming feature has a pluggable provider interface. The UI (video player, watch page, episode grid) is built. You need to implement the stream source fetching in `lib/stream-provider.ts`.

## How anime streaming sources work

Most unofficial anime sites follow the same pattern:

1. **ID Mapping** — You have an AniList/MAL ID, but the streaming source uses its own slug or ID. You need a mapping step (search the source's API by title, or use a mapping database like [ani-api mappings](https://github.com/Fribb/anime-lists)).

2. **Episode link fetching** — Once you have the source's ID, hit their episode list endpoint to get a URL for a specific episode number.

3. **Video URL extraction** — The episode page embeds a player hosted on a separate domain (GoGocdn, Vidstreaming, etc.). Parse that page for the embed URL, then parse the embed to get the actual `.m3u8` (HLS) or `.mp4` direct URL.

## Architecture

```
Browser (client)
  │
  │  fetch('/api/stream?anilistId=X&episode=Y')
  ▼
Next.js API Route (server-side)
  │  app/api/stream/route.ts
  │
  ├─ 1. Map anilistId → source slug/id
  │     (search source API by title, or use a mapping file)
  │
  ├─ 2. Fetch episode page/API for that slug + episode number
  │     (returns an embed URL or encrypted video source)
  │
  └─ 3. Extract direct video URL from embed
  │     (parse HTML, decrypt if needed, return .m3u8 or .mp4)
  │
  ▼
Returns JSON: StreamSource[]
  │  [{ url, quality, subtitles }]
  ▼
VideoPlayer component
  │  Uses hls.js for .m3u8 playback
  │  Native <video> for .mp4
  ▼
User watches anime
```

### Why server-side?

- **CORS** — Browser fetch to third-party sites is blocked by CORS. The API route fetches server-side and returns URLs to the client.
- **Anti-bot** — Some sources use Cloudflare. Server-side requests can manage cookies/headers more easily.
- **Decryption** — Video URL extraction often involves AES-256 decryption of encrypted strings. Better to keep this server-side.

## Implementation steps

### Step 1: Add hls.js to VideoPlayer

```bash
cd web && npm install hls.js
```

Update `components/VideoPlayer.tsx` to detect `.m3u8` URLs and use hls.js:

```ts
import Hls from 'hls.js';

// In the component:
useEffect(() => {
  const video = videoRef.current;
  if (!video || !current) return;

  if (current.url.includes('.m3u8') && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(current.url);
    hls.attachMedia(video);
    return () => hls.destroy();
  } else {
    video.src = current.url;
  }
}, [current]);
```

### Step 2: Create the API route

Create `app/api/stream/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const anilistId = Number(req.nextUrl.searchParams.get('anilistId'));
  const malId = req.nextUrl.searchParams.get('malId');
  const episode = Number(req.nextUrl.searchParams.get('episode'));

  // 1. Map anilistId/malId to source slug
  // 2. Fetch episode embed URL
  // 3. Extract direct video URL
  // 4. Return sources

  return NextResponse.json({ sources: [] });
}
```

### Step 3: Update stream-provider.ts

Point `getEpisodeStream` to your API route:

```ts
export async function getEpisodeStream(
  malId: number | null,
  anilistId: number,
  episode: number
): Promise<StreamSource[]> {
  const params = new URLSearchParams({
    anilistId: String(anilistId),
    episode: String(episode),
  });
  if (malId) params.set('malId', String(malId));

  const res = await fetch(`/api/stream?${params}`);
  if (!res.ok) return [];

  const data = await res.json();
  return data.sources;
}
```

### Step 4: Implement the scraping

Two approaches:

**Option A — Use an existing API wrapper (recommended to start)**

Find an open-source anime API project on GitHub that handles scraping. Either:
- Run it as a separate local service and proxy to it from your API route
- Port the relevant scraping logic directly into your API route

**Option B — Write your own scraper**

1. Pick a source site
2. Open browser DevTools → Network tab
3. Navigate to an episode and observe the API calls
4. Replicate those requests in your API route using `fetch()`
5. The typical chain: search → episode list → embed page → decrypt/parse → video URL

### Step 5: Handle CORS for video playback

Even with server-side scraping, the `.m3u8` or `.mp4` URL may need CORS headers to play in the browser. If the source blocks cross-origin playback, add a proxy route:

```ts
// app/api/proxy/route.ts
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  const res = await fetch(url);
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

Then rewrite video URLs through the proxy: `/api/proxy?url=<encoded-video-url>`

## File reference

| File | Purpose |
|---|---|
| `lib/stream-provider.ts` | Provider interface — calls API route |
| `components/VideoPlayer.tsx` | Video player — needs hls.js for .m3u8 |
| `app/api/stream/route.ts` | API route — scraping logic goes here |
| `app/api/proxy/route.ts` | Optional CORS proxy for video URLs |
| `app/(dashboard)/anime/[id]/watch/[episode]/page.tsx` | Watch page UI |

## Common video formats

| Format | Extension | Player support |
|---|---|---|
| HLS | `.m3u8` | Needs hls.js (most common for anime sources) |
| MP4 | `.mp4` | Native HTML5 `<video>` |
| DASH | `.mpd` | Needs dash.js (rare for anime) |

## Useful libraries

- **hls.js** — HLS playback in browsers
- **cheerio** — HTML parsing for server-side scraping
- **crypto** (Node built-in) — AES decryption of encrypted video URLs
