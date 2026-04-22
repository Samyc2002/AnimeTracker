import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const appwriteUserId = req.nextUrl.searchParams.get('state');

  if (!code || !appwriteUserId) {
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

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;

    const profiles = await databases.listDocuments(dbId, profilesCol, [
      Query.equal('user_id', appwriteUserId),
      Query.limit(1),
    ]);

    if (profiles.documents.length > 0) {
      await databases.updateDocument(dbId, profilesCol, profiles.documents[0].$id, {
        anilist_user_id: anilistUserId,
        anilist_token: accessToken,
      });
    }

    return NextResponse.redirect(new URL('/settings?anilist=connected', req.url));
  } catch {
    return NextResponse.redirect(new URL('/settings?anilist=error', req.url));
  }
}
