# Streaming Architecture

## Status

### Done
- [x] Stream provider interface (`lib/stream-provider.ts`) — types + client function calling API route
- [x] VideoPlayer component (`components/VideoPlayer.tsx`) — hls.js for `.m3u8`, native for `.mp4`, quality selector, subtitles, error handling
- [x] Watch page (`app/(dashboard)/anime/[id]/watch/[episode]/page.tsx`) — player, prev/next nav, mark-as-watched, episode grid
- [x] EpisodeGrid link mode (`components/EpisodeGrid.tsx`) — `linkPrefix` and `currentEpisode` props
- [x] Episode list on anime detail page (`app/(dashboard)/anime/[id]/page.tsx`) — clickable episodes linking to watch pages
- [x] Stream API route skeleton (`app/api/stream/route.ts`) — accepts `anilistId`, `malId`, `episode` params
- [x] CORS proxy route (`app/api/proxy/route.ts`) — proxies video URLs that block cross-origin playback
- [x] hls.js installed and integrated

### Pending (you implement)
- [ ] **Scraping logic in `app/api/stream/route.ts`** — the three-step pipeline:
  1. Map `anilistId`/`malId` to your source site's internal ID
  2. Fetch episode embed URL from the source
  3. Extract direct video URL (`.m3u8` or `.mp4`) from the embed
- [ ] **Install `cheerio`** (`npm install cheerio`) if you need to parse HTML from source sites
- [ ] **Decryption logic** (if needed) — some sources encrypt video URLs with AES-256; use Node's built-in `crypto` module

## Architecture

```
Browser (client)
  │
  │  getEpisodeStream() in lib/stream-provider.ts
  │  calls fetch('/api/stream?anilistId=X&episode=Y')
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
Returns JSON: { sources: StreamSource[] }
  │  [{ url, quality, subtitles }]
  ▼
VideoPlayer component
  │  hls.js for .m3u8 | native <video> for .mp4
  │  Quality selector | Subtitle tracks
  ▼
User watches anime
```

### Why server-side?

- **CORS** — Browser fetch to third-party sites is blocked. The API route fetches server-side.
- **Anti-bot** — Server-side requests can manage cookies and headers.
- **Decryption** — Video URL extraction often involves AES-256. Better to keep server-side.

## How to implement the scraping

### Step 1: Reverse-engineer a source site

1. Open the streaming site in Chrome, navigate to an episode
2. Open DevTools (`Cmd+Opt+I`) → **Network** tab → filter by **Fetch/XHR**
3. Reload and trace the request chain:
   - **Search/lookup** — maps anime name to the site's internal ID
   - **Episode list** — returns episode URLs or IDs
   - **Video embed** — returns iframe URL, encrypted source, or direct video URL
4. Right-click requests → **Copy > Copy as fetch** to get exact headers/cookies

### Step 2: Follow the embed

If you get an iframe URL (not a direct video URL):
1. Open that embed URL in a new tab
2. Open Network tab again, look for `.m3u8` or `.mp4` requests
3. If data is encrypted, check the embed page's `<script>` tags for decryption keys

### Step 3: Replicate in the API route

```ts
// app/api/stream/route.ts — pseudocode
import * as cheerio from 'cheerio';

// 1. Map ID
const searchRes = await fetch('https://source.site/api/search?q=One+Piece');
const slug = (await searchRes.json()).results[0].slug;

// 2. Get episode
const epRes = await fetch(`https://source.site/api/episode/${slug}-episode-${episode}`);
const embedUrl = (await epRes.json()).embedUrl;

// 3. Extract video URL
const embedHtml = await (await fetch(embedUrl)).text();
const $ = cheerio.load(embedHtml);
const m3u8Url = $('source').attr('src'); // or parse from script tags

// 4. Proxy if needed (for CORS)
const proxiedUrl = `/api/proxy?url=${encodeURIComponent(m3u8Url)}`;

return NextResponse.json({
  sources: [{ url: proxiedUrl, quality: '1080p' }]
});
```

### Step 4: Test

Hit `http://localhost:3000/api/stream?anilistId=21&episode=1` in the browser.
If it returns `{ sources: [...] }`, the watch page picks it up automatically.

### Tips

- **Start simple** — find a source that returns direct `.m3u8` URLs without encryption
- **Use `console.log`** in the API route to debug each step
- **If a request works in browser but not in Node** — you're missing a header (compare with "Copy as fetch")
- **Check `<script>` tags** in embed pages — decryption keys are often inline

## File reference

| File | Status | Purpose |
|---|---|---|
| `lib/stream-provider.ts` | Done | Types + client function calling API route |
| `components/VideoPlayer.tsx` | Done | hls.js player with quality/subtitle support |
| `app/api/stream/route.ts` | Skeleton | Scraping logic goes here |
| `app/api/proxy/route.ts` | Done | CORS proxy for video URLs |
| `app/(dashboard)/anime/[id]/watch/[episode]/page.tsx` | Done | Watch page UI |
| `components/EpisodeGrid.tsx` | Done | Episode grid with link + current highlight modes |
| `app/(dashboard)/anime/[id]/page.tsx` | Done | Episode list linking to watch pages |

## Common video formats

| Format | Extension | Player support |
|---|---|---|
| HLS | `.m3u8` | hls.js (integrated) |
| MP4 | `.mp4` | Native HTML5 `<video>` |
| DASH | `.mpd` | Needs dash.js (not integrated, rare for anime) |

## Dependencies

| Package | Purpose | Status |
|---|---|---|
| `hls.js` | HLS stream playback | Installed |
| `cheerio` | HTML parsing for scraping | Install when needed: `npm install cheerio` |
| `crypto` | AES decryption | Node built-in, no install needed |
