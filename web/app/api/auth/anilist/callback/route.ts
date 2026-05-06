import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const userId = req.nextUrl.searchParams.get('state');

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/settings?anilist=error', req.url));
  }

  try {
    const tokenRes = await fetch('https://anilist.co/api/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_ANILIST_CLIENT_ID,
        client_secret: process.env.ANILIST_CLIENT_SECRET,
        redirect_uri: `${req.nextUrl.origin}/api/auth/anilist/callback`,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[AniList OAuth] Token exchange failed:', tokenRes.status, errBody);
      return NextResponse.redirect(new URL('/settings?anilist=error', req.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const viewerRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: 'query { Viewer { id name } }' }),
    });

    const viewerData = await viewerRes.json();
    const anilistUserId = viewerData.data.Viewer.id;

    const supabase = getServiceSupabase();

    const { data: profileDocs } = await supabase
      .from('profiles')
      .select()
      .eq('user_id', userId)
      .limit(1);

    if (profileDocs && profileDocs.length > 0) {
      await supabase
        .from('profiles')
        .update({
          anilist_user_id: anilistUserId,
          anilist_token: accessToken,
        })
        .eq('id', profileDocs[0].id);
    }

    return NextResponse.redirect(new URL('/settings?anilist=connected', req.url));
  } catch (err) {
    console.error('[AniList OAuth] Error:', err);
    return NextResponse.redirect(new URL('/settings?anilist=error', req.url));
  }
}
