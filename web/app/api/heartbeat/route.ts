import { NextResponse } from 'next/server';
import { recordHeartbeat, getOnlineCount } from '@/lib/online-tracker';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    recordHeartbeat(userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ online_now: getOnlineCount() });
}
