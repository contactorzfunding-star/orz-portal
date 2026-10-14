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
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">Hola, {user.email}</h1>
      {user.isFounder && (
        <p className="text-sm mb-4 border border-white/20 inline-block px-3 py-1">Acceso Fundador · Reparto 90/10 · Intentos: {user.attemptsLeft}</p>
      )}
      <div className="border border-white/20 p-4 mb-6">
        <h2 className="text-xl font-semibold mb-3">Estado del Reto</h2>
        {account ? (
          <>
            <p><strong>Fase:</strong> {account.phase}</p>
            <p><strong>Estado:</strong> {statusLabel}</p>
            <p><strong>Balance inicial:</strong> ${account.initialBalance.toLocaleString()}</p>
            {liveData && (
              <>
                <p><strong>Balance actual:</strong> ${liveData.balance?.toLocaleString() || '—'}</p>
                <p><strong>Equity:</strong> ${liveData.equity?.toLocaleString() || '—'}</p>
              </>
            )}
            {!account.metaapiAccountId && (
              <p className="mt-2 text-sm text-white/60">MetaTrader aún no está conectado.</p>
            )}
            <p className="mt-2 text-sm text-white/70">Objetivo Fase 1: 8% · Fase 2: 5% · Mínimo 3 días · Sin límite de tiempo</p>
            <p className="text-sm text-white/70">Pérdida diaria máxima 5% · Pérdida máxima 10% (sobre balance)</p>
          </>
        ) : (
          <p>No hay cuenta activa.</p>
        )}
      </div>
      {riskWarnings.length > 0 && (
        <div className="border border-yellow-500/50 p-4 mb-6">
          <h3 className="font-semibold mb-2">Advertencias</h3>
          <ul className="list-disc list-inside text-sm">
            {riskWarnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      <div className="border border-white/20 p-4 text-sm">
        <h3 className="font-semibold mb-2">Reglas</h3>
        <ul className="space-y-1 text-white/80">
          <li>• Riesgo máximo 2% por operación. Sin stop loss: advertencia.</li>
          <li>• Relación 1 a 2 solo informativa.</li>
          <li>• Noticias permitidas. Cerrar antes del fin de semana.</li>
          <li>• 7 días sin operar: Suspendida.</li>
          <li>• Copy prohibido. Robot solo si cumple reglas.</li>
        </ul>
      </div>
    </div>
  );
}
