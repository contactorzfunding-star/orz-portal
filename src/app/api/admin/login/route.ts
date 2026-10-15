import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const OWNER = 'contactorzfunding@gmail.com';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  const okEmail = String(email || '').toLowerCase() === OWNER;
  if (okEmail && password === process.env.ADMIN_PASSWORD) {
    await prisma.user.upsert({
      where: { email: OWNER },
      update: { isOwner: true },
      create: { email: OWNER, isOwner: true, attemptsLeft: 0 },
    });
    const session = await getSession();
    session.isAdmin = true;
    session.email = OWNER;
    await session.save();
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
