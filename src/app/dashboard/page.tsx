import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getAccountInformation, getDeals, getPositions, closeAllPositions } from '@/lib/metaapi';
import { EquityChart } from '@/components/EquityChart';
import { LivePanel } from '@/components/LivePanel';
import { NameForm } from '@/components/NameForm';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isTrade(d: { type?: string; entryType?: string }) {
  const t = (d.type || '').toUpperCase();
  if (t.includes('BUY') || t.includes('SELL')) return true;
  if (d.entryType === 'DEAL_ENTRY_IN' || d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT') return true;
  return false;
}

function sameDay(a: Date | null | undefined, b: Date) {
  if (!a) return false;
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

type Deal = {
  type?: string;
  entryType?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  time?: string;
  symbol?: string;
  volume?: number;
  id?: string;
};

type Position = {
  symbol?: string;
  type?: string;
  volume?: number;
  profit?: number;
  unrealizedProfit?: number;
  swap?: number;
  commission?: number;
  openPrice?: number;
  currentPrice?: number;
  id?: string;
};

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
  let openPositions: Position[] = [];
  let recentDeals: Deal[] = [];
  let closedByRule = false;
  let dailyStart = account?.dailyStartBalance || balance || initial;
  let dailyLossPct = 0;
  let maxLossPct = 0;

  if (account?.metaapiAccountId) {
    try {
      const live = await getAccountInformation(account.metaapiAccountId, account.metaapiRegion);
      balance = Number(live.balance ?? balance);
      equity = Number(live.equity ?? equity);

      if (!initial) initial = balance;

      const now = new Date();
      if (!account.dailyStartDate || !sameDay(account.dailyStartDate, now)) {
        dailyStart = balance;
      } else {
        dailyStart = account.dailyStartBalance || balance;
      }

      const positions = await getPositions(account.metaapiAccountId, account.metaapiRegion);
      openPositions = Array.isArray(positions) ? positions : [];

      const deals = await getDeals(account.metaapiAccountId, account.metaapiRegion, account.createdAt.toISOString());
      const trades = (Array.isArray(deals) ? deals : [])
        .filter(isTrade)
        .sort((a: Deal, b: Deal) => new Date(a.time || 0).getTime() - new Date(b.time || 0).getTime());

      recentDeals = trades.slice().reverse().slice(0, 20);
      hasTrades = trades.length > 0 || openPositions.length > 0;

      points = [{ t: 'inicio', v: initial }];
      points.push({ t: 'ahora', v: balance });

      maxLossPct = initial ? Math.max(0, ((initial - balance) / initial) * 100) : 0;
      dailyLossPct = dailyStart ? Math.max(0, ((dailyStart - balance) / dailyStart) * 100) : 0;

      const daysIdle = lastTrade
        ? (Date.now() - lastTrade.getTime()) / (1000 * 60 * 60 * 24)
        : (Date.now() - account.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      if (hasTrades && maxLossPct >= 10) status = 'reprobada';
      else if (hasTrades && dailyLossPct >= 5) status = 'suspendida';
      else if (hasTrades && daysIdle >= 7) status = 'suspendida';
      else if (status === 'reprobada' || status === 'pendiente') status = 'active';

      if ((status === 'reprobada' || status === 'suspendida') && openPositions.length > 0) {
        try {
          await closeAllPositions(account.metaapiAccountId, account.metaapiRegion);
          closedByRule = true;
          openPositions = [];
        } catch (e) {
          console.error('Close', e);
        }
      }

      await prisma.account.update({
        where: { id: account.id },
        data: {
          initialBalance: initial,
          currentBalance: balance,
          currentEquity: equity,
          maxDrawdownPercent: Math.max(account.maxDrawdownPercent || 0, maxLossPct),
          dailyLossPercent: dailyLossPct,
          dailyStartBalance: dailyStart,
          dailyStartDate: now,
          lastTradeDate: lastTrade,
          status,
        },
      });
    } catch (e) {
      console.error('MetaApi', e);
    }
  }

  const profitPct = initial ? ((balance - initial) / initial) * 100 : 0;
  const progress = Math.max(0, Math.min(100, (profitPct / (goal * 100)) * 100));
  const remainingDailyUsd = Math.max(0, (dailyStart * 0.05) - Math.max(0, dailyStart - balance));
  const remainingDailyPct = dailyStart ? Math.max(0, 5 - dailyLossPct) : 5;
  const remainingMaxUsd = Math.max(0, (initial * 0.10) - Math.max(0, initial - balance));
  const remainingMaxPct = Math.max(0, 10 - maxLossPct);

  return (
    <div className="page">
      <p className="kicker">Portal del cliente</p>
      <NameForm initial={user.name} />
      <p style={{ marginTop: 6, color: 'rgba(255,255,255,.7)' }}>{user.email}</p>
      {user.isFounder && (
        <div className="badge">Acceso Fundador · Reparto 90/10 · Intentos {user.attemptsLeft}</div>
      )}

      <LivePanel
        initialBalance={balance}
        initialEquity={equity}
        initialStart={initial}
        initialPositions={openPositions}
        dailyStart={dailyStart}
        status={status}
      />

      <section className="card">
        <h2>Avance</h2>
        <p>Fase {account?.phase || 1} · {status}</p>
        <EquityChart points={points} initial={initial} goal={goal} />
        <div className="legend">
          <span>Objetivo {Math.round(goal * 100)}%</span>
          <span>Pérdida diaria 5%</span>
          <span>Pérdida máxima 10%</span>
        </div>
        {status === 'reprobada' && <p>Cuenta reprobada. La pérdida llegó al 10% sobre balance. Las operaciones se cerraron en MetaTrader 5.</p>}
        {status === 'suspendida' && dailyLossPct >= 5 && <p>Cuenta suspendida. Llegó al límite de pérdida diaria del 5% sobre balance. Las operaciones se cerraron en MetaTrader 5.</p>}
        {status === 'suspendida' && dailyLossPct < 5 && <p>Cuenta suspendida. Pasaron 7 días sin operar. Las operaciones se cerraron.</p>}
        {closedByRule && <p>Se cerraron las posiciones abiertas por límite.</p>}
        {!account?.metaapiAccountId && (
          <p style={{ color: 'rgba(255,255,255,.65)' }}>MetaTrader aún no está conectado.</p>
        )}
      </section>

      <section className="card">
        <h2>Operaciones cerradas</h2>
        {recentDeals.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,.65)' }}>Aún no hay operaciones cerradas.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recentDeals
              .filter((d) => d.entryType === 'DEAL_ENTRY_OUT' || d.entryType === 'DEAL_ENTRY_INOUT' || d.profit)
              .map((d) => (
                <div key={d.id || d.time} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{d.symbol} · {String(d.type || '').replace('DEAL_TYPE_', '')} · {d.volume}</span>
                  <b>{money(Number(d.profit || 0))}</b>
                </div>
              ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Límites</h2>
        <p className="kicker">Avance al objetivo {Math.round(goal * 100)}%</p>
        <div className="meter"><i style={{ ['--w' as string]: `${progress}%` }} /></div>

        <p className="kicker">Pérdida diaria sobre balance · límite 5%</p>
        <div className="meter"><i style={{ ['--w' as string]: `${Math.min(100, (dailyLossPct / 5) * 100)}%` }} /></div>
        <p>Faltan {money(remainingDailyUsd)} ({remainingDailyPct.toFixed(2)}%) para el 5% diario.</p>

        <p className="kicker">Pérdida máxima sobre balance · límite 10%</p>
        <div className="meter"><i style={{ ['--w' as string]: `${Math.min(100, (maxLossPct / 10) * 100)}%` }} /></div>
        <p>Faltan {money(remainingMaxUsd)} ({remainingMaxPct.toFixed(2)}%) para el 10% máximo.</p>
      </section>

      <section className="card facts">
        <h2>Reglas</h2>
        <p>Objetivo Fase 1: 8%. Fase 2: 5%. Mínimo 3 días. Sin límite de tiempo.</p>
        <p>Pérdida diaria 5% y máxima 10% sobre balance, no sobre equity.</p>
        <p>Si se llega al 5% diario o al 10% máximo, la cuenta se suspende y se cierran las operaciones en MetaTrader 5.</p>
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
