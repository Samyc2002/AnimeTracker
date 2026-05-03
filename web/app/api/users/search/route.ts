import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const profilesCol = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;

    const res = await databases.listDocuments(dbId, profilesCol, [
      Query.search('username', q),
      Query.equal('is_public', true),
      Query.limit(10),
    ]);

    const users = res.documents.map((doc) => ({
      userId: doc.user_id as string,
      username: doc.username as string,
      displayName: (doc.display_name as string) || null,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 },
    );
  }
}
