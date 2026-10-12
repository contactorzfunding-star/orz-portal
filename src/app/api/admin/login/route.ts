import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password === process.env.ADMIN_PASSWORD) {
    const session = await getSession();
    session.isAdmin = true;
    await session.save();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}