import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { name },
  });

  return NextResponse.json({ ok: true, name });
}
