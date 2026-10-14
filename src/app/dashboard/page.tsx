import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getAccountInformation } from '@/lib/metaapi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

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
  const initial = account?.initialBalance || 10000;
  const goal = account?.phase === 2 ? 0.05 : 0.08;

  let balance = account?.currentBalance || initial;
  let equity = account?.currentEquity || balance;
  if (account?.metaapiAccountId) {
    try {
      const live = await getAccountInformation(account.metaapiAccountId, account.metaapiRegion);
      balance = live.balance ?? balance;
      equity = live.equity ?? equity;
    } catch (e) {
      console.error('MetaApi', e);
    }
  }

  const profit = balance - initial;
  const profitPct = (profit / initial) * 100;
  const progress = Math.max(0, Math.min(100, (profitPct / (goal * 100)) * 100));
  const dailyLoss = Math.max(0, ((initial - balance) / initial) * 100);
  const status = dailyLoss > 5 || (account?.maxDrawdownPercent || 0) > 10 ? 'Reprobada' : account?.status || 'pendiente';

  return (
    <div className="page">
      <p className="kicker">Portal del cliente</p>
      <h1>Hola</h1>
      <p style={{ marginTop: -6, color: 'rgba(255,255,255,.7)' }}>{user.email}</p>
      {user.isFounder && (
        <div className="badge">Acceso Fundador · Reparto 90/10 · Intentos {user.attemptsLeft}</div>
      )}

      <div className="grid">
        <div className="tile"><span>Balance inicial</span><b>{money(initial)}</b></div>
        <div className="tile"><span>Balance</span><b>{money(balance)}</b></div>
        <div className="tile"><span>Equity</span><b>{money(equity)}</b></div>
      </div>

      <section className="card">
        <h2>Estado del reto</h2>
        <p>Fase {account?.phase || 1} · {status}</p>
        <p className="kicker" style={{ marginTop: 18 }}>Avance al objetivo {Math.round(goal * 100)}%</p>
        <div className="meter"><i style={{ ['--w' as string]: `${progress}%` }} /></div>
        <p>{profit >= 0 ? '+' : ''}{profitPct.toFixed(2)}% sobre el balance inicial.</p>
        {!account?.metaapiAccountId && (
          <p style={{ color: 'rgba(255,255,255,.65)' }}>MetaTrader aún no está conectado. Cuando se entreguen las credenciales, aquí se ven las métricas.</p>
        )}
      </section>

      <section className="card">
        <h2>Límites</h2>
        <p className="kicker">Pérdida diaria 5% sobre balance</p>
        <div className="meter"><i style={{ ['--w' as string]: `${Math.min(100, (dailyLoss / 5) * 100)}%` }} /></div>
        <p className="kicker">Pérdida máxima 10% sobre balance</p>
        <div className="meter"><i style={{ ['--w' as string]: `${Math.min(100, ((account?.maxDrawdownPercent || dailyLoss) / 10) * 100)}%` }} /></div>
      </section>

      <section className="card facts">
        <h2>Reglas</h2>
        <p>Objetivo Fase 1: 8%. Fase 2: 5%. Mínimo 3 días. Sin límite de tiempo.</p>
        <p>Riesgo máximo 2% por operación. Sin stop loss: advertencia.</p>
        <p>Noticias permitidas. Cerrar posiciones antes del cierre semanal.</p>
        <p>7 días sin operar: cuenta suspendida.</p>
        <p>Copy trading prohibido. Robot solo si cumple las reglas.</p>
        <p>El capital de la fase es simulado. Lo que se paga en dinero real es la ganancia elegible.</p>
      </section>

      <form action="/api/auth/logout" method="post">
        <button className="btn line" type="submit">Salir</button>
      </form>
    </div>
  );
}
