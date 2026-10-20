import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getAccountInformation, getPositions } from '@/lib/metaapi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: 'No session' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { accounts: { orderBy: { createdAt: 'desc' } } },
    });
    const account = user?.accounts[0];
    if (!account?.metaapiAccountId) {
      return NextResponse.json({ balance: 0, equity: 0, positions: [] });
    }

    const live = await getAccountInformation(account.metaapiAccountId, account.metaapiRegion);
    const positions = await getPositions(account.metaapiAccountId, account.metaapiRegion);

    return NextResponse.json({
      balance: Number(live.balance || 0),
      equity: Number(live.equity || 0),
      positions: Array.isArray(positions) ? positions : [],
      initial: account.initialBalance || 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'live' }, { status: 500 });
  }
}
