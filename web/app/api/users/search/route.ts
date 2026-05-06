import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q');
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const supabase = getServiceSupabase();

    const { data: docs, error } = await supabase
      .from('profiles')
      .select()
      .ilike('username', `%${q}%`)
      .eq('is_public', true)
      .limit(10);

    if (error) throw error;

    const users = (docs || []).map((doc) => ({
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
