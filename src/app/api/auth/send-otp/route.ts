import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: 'Este correo no tiene una compra registrada' }, { status: 403 });
    }

    // Invalidate previous unused OTPs
    await prisma.otp.updateMany({
      where: { email: email.toLowerCase(), used: false },
      data: { used: true },
    });

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otp.create({
      data: {
        email: email.toLowerCase(),
        code,
        expiresAt,
        userId: user.id,
      },
    });

    await sendOtpEmail(email, code);

    return NextResponse.json({ success: true, message: 'Código enviado' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al enviar el código' }, { status: 500 });
  }
}