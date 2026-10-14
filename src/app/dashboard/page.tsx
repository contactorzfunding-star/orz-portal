import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getAccountInformation, getPositions } from '@/lib/metaapi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  await connection();
  const session = await getSession();
  if (!session.userId) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { accounts: { orderBy: { createdAt: 'desc' } } },
  });
  if (!user) redirect('/login');

  const account = user.accounts[0];
  let liveData: { balance?: number; equity?: number } | null = null;
  let riskWarnings: string[] = [];

  if (account?.metaapiAccountId) {
    try {
      liveData = await getAccountInformation(account.metaapiAccountId, account.metaapiRegion);
      const positions = await getPositions(account.metaapiAccountId, account.metaapiRegion);
      positions.forEach((pos: { id?: string; profit?: number; stopLoss?: number }) => {
        const risk = Math.abs(pos.profit || 0) / (account.initialBalance || 10000) * 100;
        if (risk > 2) riskWarnings.push(`Operación ${pos.id} supera 2% de riesgo`);
        if (!pos.stopLoss) riskWarnings.push(`Operación ${pos.id} sin Stop Loss`);
      });
    } catch (e) {
      console.error('MetaApi error', e);
    }
  }

  let statusLabel = account?.status || 'pendiente';
  if (liveData && account) {
    const balance = liveData.balance || account.currentBalance || account.initialBalance;
    const dailyLoss = ((account.initialBalance - balance) / account.initialBalance) * 100;
    if (dailyLoss > 5 || (account.maxDrawdownPercent || 0) > 10) statusLabel = 'Reprobada';
  }

  return (
    <div className="flex justify-center px-4 py-10">
      <div className="sheet" style={{ width: 'min(720px, 100%)' }}>
        <p className="kicker">ORZ Funding</p>
        <h1>Hola, {user.email}</h1>
        {user.isFounder && (
          <p className="text-sm mb-6 border border-white/30 inline-block px-3 py-1 rounded-full">Acceso Fundador · 90/10 · Intentos: {user.attemptsLeft}</p>
        )}
        {account ? (
          <div className="space-y-2 text-sm">
            <p><strong>Fase:</strong> {account.phase}</p>
            <p><strong>Estado:</strong> {statusLabel}</p>
            <p><strong>Balance inicial:</strong> ${account.initialBalance.toLocaleString()}</p>
            {liveData && (
              <>
                <p><strong>Balance actual:</strong> ${liveData.balance?.toLocaleString() || '—'}</p>
                <p><strong>Equity:</strong> ${liveData.equity?.toLocaleString() || '—'}</p>
              </>
            )}
            {!account.metaapiAccountId && <p className="text-white/60 mt-3">MetaTrader aún no está conectado.</p>}
            <p className="text-white/70 mt-4">Objetivo Fase 1: 8% · Fase 2: 5% · Mínimo 3 días · Sin límite de tiempo</p>
            <p className="text-white/70">Pérdida diaria máxima 5% · Pérdida máxima 10% (sobre balance)</p>
          </div>
        ) : (
          <p>No hay cuenta activa.</p>
        )}
        {riskWarnings.length > 0 && (
          <ul className="mt-6 text-sm list-disc list-inside">
            {riskWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
