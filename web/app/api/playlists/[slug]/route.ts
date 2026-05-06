import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('playlists')
      .select()
      .eq('slug', slug)
      .eq('visibility', 'Public')
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const doc = data[0];
    return NextResponse.json({
      title: doc.title,
      description: doc.description,
      anime_ids: JSON.parse((doc.anime_ids as string) || '[]'),
      slug: doc.slug,
      created_at: doc.created_at,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch playlist' }, { status: 500 });
  }
}
