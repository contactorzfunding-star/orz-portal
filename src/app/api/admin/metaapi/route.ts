import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { createMetaApiAccount, deployMetaApiAccount } from '@/lib/metaapi';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!process.env.METAAPI_TOKEN) {
      return NextResponse.json({ error: 'Falta METAAPI_TOKEN en Vercel' }, { status: 500 });
    }

    const { id } = await req.json();
    const account = await prisma.account.findUnique({ where: { id }, include: { user: true } });
    if (!account) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    if (!account.mt5Login || !account.mt5Server || !account.mt5InvestorPassword) {
      return NextResponse.json({ error: 'Faltan login, servidor o contraseña de inversionista' }, { status: 400 });
    }

    const password = decrypt(account.mt5InvestorPassword);
    const created = await createMetaApiAccount({
      login: account.mt5Login,
      password,
      server: account.mt5Server,
      name: account.user.email,
    });
    const metaId = created.id || created._id;
    if (!metaId) {
      return NextResponse.json({ error: 'MetaApi no devolvió id', detail: created }, { status: 502 });
    }

    try {
      await deployMetaApiAccount(metaId);
    } catch {
      // deploy can be async; account may already be deploying
    }

    await prisma.account.update({
      where: { id },
      data: {
        metaapiAccountId: metaId,
        metaapiRegion: created.region || 'new-york',
        status: 'active',
      },
    });

    return NextResponse.json({ success: true, metaapiAccountId: metaId });
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
