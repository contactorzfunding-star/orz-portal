import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, isFounder } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: { isFounder: Boolean(isFounder) },
      create: {
        email: email.toLowerCase(),
        isFounder: Boolean(isFounder),
        attemptsLeft: 3,
        accounts: {
          create: {
            phase: 1,
            status: 'pending',
            initialBalance: 10000,
          },
        },
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'No se pudo crear el cliente' }, { status: 500 });
  }
}
