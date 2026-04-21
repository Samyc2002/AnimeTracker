# Anime Tracker

Track your anime watchlist and get notified when new episodes drop. Available as a Chrome extension and a web app.

## Monorepo Structure

```
anime-tracker/
├── ext/          # Chrome Extension (Manifest V3, vanilla JS)
├── web/          # Web App (Next.js, Supabase)
├── ARCHITECTURE.md
└── CLAUDE.md
```

## Chrome Extension (`ext/`)

A browser extension that polls AniList for new episodes and sends native OS notifications.

### Install
1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `ext/` folder

### Features
- Search & add anime to your watchlist
- Episode tracking with click-to-toggle grid
- Background polling with native notifications
- Notification feed as default view

## Web App (`web/`)

A full-stack web app with user accounts, watchlist management, and an airing schedule view.

### Setup
1. Create a Supabase project at https://supabase.com
2. Run `web/supabase-schema.sql` in the Supabase SQL Editor
3. Copy `web/.env.local.example` to `web/.env.local` and fill in your Supabase keys
4. Install and run:
   ```bash
   cd web
   npm install
   npm run dev
   ```

### Features
- User auth (email/password via Supabase)
- Watchlist with episode tracking
- AniList search and add
- Weekly airing schedule
- Settings (title language preference)

## AniList API

Both the extension and web app use the [AniList GraphQL API](https://graphql.anilist.co). No authentication required — all queries are public. Rate limit: 90 requests/minute.

## License

MIT
