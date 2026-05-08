import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from('founding_member_config')
      .select('count, max_members')
      .eq('id', 'counter')
      .single();

    return NextResponse.json({
      count: data?.count ?? 0,
      max: data?.max_members ?? 100,
    });
  } catch {
    return NextResponse.json({ count: 0, max: 100 });
  }
}
