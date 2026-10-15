import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) throw new Error('Unauthorized');
}

export async function GET() {
  try {
    await requireAdmin();
    const accounts = await prisma.account.findMany({
      include: { user: { select: { email: true, isFounder: true, attemptsLeft: true, isOwner: true } } },
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
    const { id, mt5Login, mt5Server, mt5InvestorPassword, status, phase } = body;

    const data: any = {};
    if (mt5Login !== undefined) data.mt5Login = mt5Login;
    if (mt5Server !== undefined) data.mt5Server = mt5Server;
    if (mt5InvestorPassword) data.mt5InvestorPassword = encrypt(mt5InvestorPassword);
    if (status) data.status = status;
    if (phase) data.phase = Number(phase);

    const updated = await prisma.account.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error updating' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const { id } = await req.json();
    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: 'No existe' }, { status: 404 });

    await prisma.account.delete({ where: { id } });

    const left = await prisma.account.count({ where: { userId: account.userId } });
    if (left === 0) {
      const user = await prisma.user.findUnique({ where: { id: account.userId } });
      if (user && !user.isOwner) {
        await prisma.otp.deleteMany({ where: { userId: user.id } });
        await prisma.founderSpot.deleteMany({ where: { email: user.email } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  }
}
