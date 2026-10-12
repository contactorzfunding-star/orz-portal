import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const otp = await prisma.otp.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        used: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!otp || !otp.user) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 401 });
    }

    await prisma.otp.update({
      where: { id: otp.id },
      data: { used: true },
    });

    const session = await getSession();
    session.userId = otp.user.id;
    session.email = otp.user.email;
    session.isAdmin = false;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al verificar' }, { status: 500 });
  }
}