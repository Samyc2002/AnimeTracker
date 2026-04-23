import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0b0e14 0%, #141925 50%, #0b0e14 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '24px',
          }}
        >
          <img
            src="https://animetracker.lol/logo.png"
            width={80}
            height={80}
            style={{ borderRadius: '16px' }}
          />
          <span
            style={{
              fontSize: '56px',
              fontWeight: 800,
              background: 'linear-gradient(to right, #2dd4bf, #60a5fa)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Anime Tracker
          </span>
        </div>
        <p
          style={{
            fontSize: '24px',
            color: '#9ca3af',
            maxWidth: '700px',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Track your watchlist, follow airing schedules, sync with AniList, and share curated playlists.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '32px',
          }}
        >
          <div style={{ background: '#0d9488', color: 'white', padding: '10px 24px', borderRadius: '8px', fontSize: '18px', fontWeight: 600 }}>
            Get Started Free
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
