import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const databases = new Databases(client);
    const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
    const playlistsCol = process.env.NEXT_PUBLIC_APPWRITE_PLAYLISTS_COLLECTION_ID!;

    const res = await databases.listDocuments(dbId, playlistsCol, [
      Query.equal('slug', slug),
      Query.equal('visibility', 'public'),
      Query.limit(1),
    ]);

    if (res.documents.length === 0) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const doc = res.documents[0];
    return NextResponse.json({
      title: doc.title,
      description: doc.description,
      anime_ids: JSON.parse((doc.anime_ids as string) || '[]'),
      slug: doc.slug,
      created_at: doc.$createdAt,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 });
  }
}
