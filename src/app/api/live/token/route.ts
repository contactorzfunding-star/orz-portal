import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function sign(accountId: string) {
  const secret = process.env.STREAM_SECRET || '';
  return crypto.createHmac('sha256', secret).update(accountId).digest('hex');
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'No session' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { accounts: { orderBy: { createdAt: 'desc' } } },
  });
  const account = user?.accounts[0];
  if (!account?.metaapiAccountId) {
    return NextResponse.json({ error: 'No account' }, { status: 400 });
  }

  const streamer = process.env.STREAMER_URL || '';
  if (!streamer || !process.env.STREAM_SECRET) {
    return NextResponse.json({ error: 'Streamer not configured' }, { status: 500 });
  }

  const token = sign(account.metaapiAccountId);
  const url = `${streamer.replace(/\/$/, '')}/stream?accountId=${encodeURIComponent(account.metaapiAccountId)}&token=${token}&region=${encodeURIComponent(account.metaapiRegion || 'new-york')}&initial=${account.initialBalance || 0}&dailyStart=${account.dailyStartBalance || account.initialBalance || 0}&status=${encodeURIComponent(account.status || 'active')}`;

  return NextResponse.json({ url });
}
