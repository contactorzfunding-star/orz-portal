import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getAccountInformation, getDeals, getPositions } from '@/lib/metaapi';
import { EquityChart } from '@/components/EquityChart';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function isTrade(d: { type?: string; entryType?: string; profit?: number }) {
  const t = (d.type || '').toUpperCase();
  if (t.includes('BUY') || t.includes('SELL')) return true;
  if (d.entryType === 'DEAL_ENTRY_IN' || d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT') return true;
  return false;
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
  let initial = account?.initialBalance || 0;
  const goal = account?.phase === 2 ? 0.05 : 0.08;

  let balance = account?.currentBalance || initial || 0;
  let equity = account?.currentEquity || balance;
  let points: { t: string; v: number }[] = [{ t: 'inicio', v: initial || balance }];
  let lastTrade: Date | null = account?.lastTradeDate || null;
  let status = account?.status || 'active';
  let hasTrades = false;
  let openCount = 0;

  if (account?.metaapiAccountId) {
    try {
      const live = await getAccountInformation(account.metaapiAccountId, account.metaapiRegion);
      balance = Number(live.balance ?? balance);
      equity = Number(live.equity ?? equity);

      // Solo la primera vez: el balance actual es el inicial.
      if (!initial || initial === 10000) {
        initial = balance;
      }

      const positions = await getPositions(account.metaapiAccountId, account.metaapiRegion);
      openCount = Array.isArray(positions) ? positions.length : 0;

      const deals = await getDeals(account.metaapiAccountId, account.metaapiRegion, account.createdAt.toISOString());
      const trades = (Array.isArray(deals) ? deals : [])
        .filter(isTrade)
        .sort((a: { time?: string }, b: { time?: string }) => new Date(a.time || 0).getTime() - new Date(b.time || 0).getTime());

      hasTrades = trades.length > 0 || openCount > 0;

      points = [{ t: 'inicio', v: initial }];
      let running = initial;
      for (const deal of trades) {
        if (deal.entryType === 'DEAL_ENTRY_OUT' || deal.entryType === 'DEAL_ENTRY_INOUT' || deal.profit) {
          running += Number(deal.profit || 0) + Number(deal.commission || 0) + Number(deal.swap || 0);
          points.push({ t: deal.time || String(points.length), v: running });
        }
        if (deal.time) lastTrade = new Date(deal.time);
      }
      points.push({ t: 'ahora', v: balance });

      const lossPct = Math.max(0, ((initial - balance) / initial) * 100);
      const daysIdle = lastTrade
        ? (Date.now() - lastTrade.getTime()) / (1000 * 60 * 60 * 24)
        : (Date.now() - account.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      if (hasTrades && lossPct >= 10) status = 'reprobada';
      else if (hasTrades && daysIdle >= 7) status = 'suspendida';
      else if (status === 'reprobada' || status === 'pendiente') status = 'active';

      await prisma.account.update({
        where: { id: account.id },
        data: {
          initialBalance: initial,
          currentBalance: balance,
          currentEquity: equity,
          maxDrawdownPercent: Math.max(account.maxDrawdownPercent || 0, lossPct),
          dailyLossPercent: lossPct,
          lastTradeDate: lastTrade,
          status,
        },
      });
    } catch (e) {
      console.error('MetaApi', e);
    }
  }

  const profit = balance - initial;
  const profitPct = initial ? (profit / initial) * 100 : 0;
  const progress = Math.max(0, Math.min(100, (profitPct / (goal * 100)) * 100));
  const lossPct = initial ? Math.max(0, ((initial - balance) / initial) * 100) : 0;

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
        <h2>Avance</h2>
        <p>Fase {account?.phase || 1} · {status} · {profit >= 0 ? '+' : ''}{profitPct.toFixed(2)}%</p>
        <EquityChart points={points} initial={initial} goal={goal} />
        <div className="legend">
          <span>Objetivo {Math.round(goal * 100)}%</span>
          <span>Pérdida diaria 5%</span>
          <span>Pérdida máxima 10%</span>
        </div>
        {openCount > 0 && <p>Operaciones abiertas: {openCount}</p>}
        {!hasTrades && account?.metaapiAccountId && (
          <p style={{ color: 'rgba(255,255,255,.65)' }}>Aún no hay operaciones cerradas. El avance se calcula con el balance.</p>
        )}
        {status === 'reprobada' && (
          <p>Cuenta reprobada. La pérdida llegó al 10% sobre balance.</p>
        )}
        {status === 'suspendida' && (
          <p>Cuenta suspendida. Pasaron 7 días sin operar.</p>
        )}
        {!account?.metaapiAccountId && (
          <p style={{ color: 'rgba(255,255,255,.65)' }}>MetaTrader aún no está conectado.</p>
        )}
      </section>

      <section className="card">
        <h2>Límites</h2>
        <p className="kicker">Avance al objetivo {Math.round(goal * 100)}%</p>
        <div className="meter"><i style={{ ['--w' as string]: `${progress}%` }} /></div>
        <p className="kicker">Pérdida sobre balance. Máxima 10%</p>
        <div className="meter"><i style={{ ['--w' as string]: `${Math.min(100, (lossPct / 10) * 100)}%` }} /></div>
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
