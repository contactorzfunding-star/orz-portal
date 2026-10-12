import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) {
    throw new Error('Unauthorized');
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const accounts = await prisma.account.findMany({
      include: { user: { select: { email: true, isFounder: true, attemptsLeft: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { id, mt5Login, mt5Server, mt5InvestorPassword, status } = body;

    const data: any = {};
    if (mt5Login !== undefined) data.mt5Login = mt5Login;
    if (mt5Server !== undefined) data.mt5Server = mt5Server;
    if (mt5InvestorPassword) data.mt5InvestorPassword = encrypt(mt5InvestorPassword);
    if (status) data.status = status;

    const updated = await prisma.account.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating' }, { status: 500 });
  }
}