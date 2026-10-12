import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (!hmacHeader || !secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    if (hash !== hmacHeader) {
      return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
    }

    const order = JSON.parse(body);

    if (order.financial_status !== 'paid') {
      return NextResponse.json({ received: true });
    }

    const email = order.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'No email' }, { status: 400 });
    }

    // Check if founder product
    const isFounder = order.line_items?.some((item: any) =>
      item.title?.toLowerCase().includes('fundador') ||
      item.title?.toLowerCase().includes('acceso fundador')
    );

    // Limit founder spots
    if (isFounder) {
      const founderCount = await prisma.founderSpot.count();
      if (founderCount >= 25) {
        console.warn('Founder spots full for', email);
      } else {
        await prisma.founderSpot.upsert({
          where: { email },
          update: {},
          create: { email },
        });
      }
    }

    // Create or get user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        isFounder: isFounder && (await prisma.founderSpot.count({ where: { email } })) > 0,
      },
      create: {
        email,
        isFounder: isFounder,
        attemptsLeft: isFounder ? 3 : 1,
      },
    });

    // Create Phase 1 account if not exists active
    const existingActive = await prisma.account.findFirst({
      where: { userId: user.id, status: { in: ['active', 'pending'] } },
    });

    if (!existingActive) {
      await prisma.account.create({
        data: {
          userId: user.id,
          phase: 1,
          status: 'pending',
          initialBalance: 10000,
        },
      });
    }

    return NextResponse.json({ received: true, userId: user.id });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}