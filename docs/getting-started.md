# Getting Started

This guide gets you from clone to running locally in about 10 minutes.

## Prerequisites

- **Node.js** (check `.node-version` in the repo root for the exact version)
- **npm**
- **Chrome** or Chromium-based browser (for extension development)
- A **Supabase** account (free tier works) -- [supabase.com](https://supabase.com)
- (Optional) An **AniList developer app** for OAuth testing -- [anilist.co/settings/developer](https://anilist.co/settings/developer)

## Web App Setup

### 1. Install dependencies

```bash
cd web
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your SQL migration files from a maintainer (the `scripts/` directory is gitignored)
3. Run the numbered SQL files (001 through 014) in order in the Supabase SQL Editor

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the required values:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `NEXT_PUBLIC_ANILIST_CLIENT_ID` | No | AniList OAuth client ID |
| `ANILIST_CLIENT_SECRET` | No | AniList OAuth secret |
| `ADMIN_EMAILS` | No | Comma-separated admin emails |
| `TEST_ACCOUNTS` | No | Comma-separated test account emails |
| `CRON_SECRET` | No | Auth for Netlify scheduled functions |

### 4. Run the dev server

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### 5. Verify

- Sign up with an email
- Browse the search page and search for an anime
- Add something to your watchlist

## Chrome Extension Setup

The extension has **no build step** -- it's plain JS loaded directly by Chrome.

### 1. Copy the config file

```bash
cp ext/lib/config.example.js ext/lib/config.js
```

Fill in the values (Appwrite/Supabase endpoints). See `config.example.js` for what's needed.

### 2. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top right)
3. Click **Load unpacked** and select the `ext/` folder

### 3. Test it

Click the extension icon in Chrome's toolbar. You should see the notification feed. Try searching for an anime and adding it to your watchlist.

## Running Tests

```bash
cd web
npx vitest run             # all 123 tests
npx vitest run --coverage  # with coverage report
```

- Coverage threshold: **80%** enforced, target **90%+**
- Tests run automatically on every commit via a Husky pre-commit hook
- Never use `--no-verify` to skip the hook

## Common Issues

**"Missing environment variable" errors**
Check your `web/.env.local` against `.env.local.example`. All `NEXT_PUBLIC_*` vars are required.

**Extension won't load**
Make sure `manifest.json` is at the root of `ext/`, not in a subfolder. Check that Developer Mode is enabled.

**Tests fail on first clone**
Run `npm install` in `web/` first. Some test dependencies need to be installed.

**`recharts` type error during `tsc --noEmit`**
This is a known pre-existing issue with the stats page. It doesn't affect functionality.

## Next Steps

- Read the [architecture overview](architecture.md) to understand the system
- Check out the [web app guide](web-app.md) or [extension guide](extension.md) for the area you want to contribute to
- See [CONTRIBUTING.md](../CONTRIBUTING.md) for the PR process
