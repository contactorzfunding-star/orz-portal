'use client';

import { useEffect, useState } from 'react';

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Position = {
  id?: string;
  symbol?: string;
  type?: string;
  volume?: number;
  profit?: number;
  unrealizedProfit?: number;
};

type Live = {
  balance: number;
  equity: number;
  initial: number;
  dailyStart: number;
  positions: Position[];
  status?: string;
  ts?: number;
};

export function LivePanel({
  initialBalance,
  initialEquity,
  initialStart,
  initialPositions,
  dailyStart = 0,
  status = 'active',
}: {
  initialBalance: number;
  initialEquity: number;
  initialStart: number;
  initialPositions: Position[];
  dailyStart?: number;
  status?: string;
}) {
  const [data, setData] = useState<Live>({
    balance: initialBalance,
    equity: initialEquity,
    initial: initialStart,
    dailyStart: dailyStart || initialStart,
    positions: initialPositions,
    status,
  });
  const [live, setLive] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('local');

  useEffect(() => {
    let on = true;
    let source: EventSource | null = null;
    let emptyStreak = 0;

    async function connect() {
      let url = '/api/live/stream';
      try {
        const res = await fetch('/api/live/token');
        if (res.ok) {
          const json = await res.json();
          if (json.url) {
            url = json.url;
            setSourceLabel('en vivo');
          }
        }
      } catch {
        // fallback al canal local
      }

      if (!on) return;
      source = new EventSource(url);
      source.onmessage = (e) => {
        if (!on) return;
        try {
          const json = JSON.parse(e.data);
          setData((prev) => {
            const incoming = Array.isArray(json.positions) ? json.positions : [];
            let positions = incoming;
            if (incoming.length === 0 && prev.positions.length > 0) {
              emptyStreak += 1;
              if (emptyStreak < 6) positions = prev.positions;
              else emptyStreak = 0;
            } else {
              emptyStreak = 0;
            }
            return { ...prev, ...json, positions };
          });
          setLive(true);
        } catch {
          // ignora
        }
      };
      source.onerror = () => {
        setLive(false);
        source?.close();
        if (on) setTimeout(connect, 1500);
      };
    }

    connect();
    return () => {
      on = false;
      source?.close();
    };
  }, []);

  const profit = data.balance - data.initial;
  const floating = data.equity - data.balance;
  const pct = data.initial ? (profit / data.initial) * 100 : 0;
  const dailyLoss = data.dailyStart ? Math.max(0, data.dailyStart - data.balance) : 0;
  const dailyLossPct = data.dailyStart ? (dailyLoss / data.dailyStart) * 100 : 0;
  const remainingDaily = Math.max(0, data.dailyStart * 0.05 - dailyLoss);
  const remainingPct = Math.max(0, 5 - dailyLossPct);

  return (
    <>
      <div className="grid">
        <div className="tile"><span>Balance inicial</span><b>{money(data.initial)}</b></div>
        <div className="tile"><span>Balance</span><b>{money(data.balance)}</b></div>
        <div className="tile"><span>Equity</span><b>{money(data.equity)}</b></div>
      </div>

      <section className="card">
        <h2>En vivo {live && <span style={{ fontSize: 12, letterSpacing: '.08em', color: 'rgba(255,255,255,.55)' }}>· {sourceLabel.toUpperCase()}</span>}</h2>
        <p>Ganancia cerrada: {profit >= 0 ? '+' : ''}{money(profit)} ({pct.toFixed(2)}%)</p>
        <p>Flotante: {floating >= 0 ? '+' : ''}{money(floating)}</p>
        <p style={{ marginTop: 10 }}>Faltan {money(remainingDaily)} ({remainingPct.toFixed(2)}%) para el límite diario del 5%.</p>
        {data.status === 'suspendida' && <p>Cuenta suspendida.</p>}
        {data.status === 'reprobada' && <p>Cuenta reprobada.</p>}
        <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 13 }}>Canal en vivo. Se mueve cuando cambia MetaTrader.</p>
      </section>

      <section className="card">
        <h2>Operaciones abiertas</h2>
        {data.positions.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,.65)' }}>No hay operaciones abiertas.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.positions.map((p) => {
              const pl = Number(p.unrealizedProfit ?? p.profit ?? 0);
              return (
                <div key={p.id || p.symbol} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{p.symbol} · {String(p.type || '').replace('POSITION_TYPE_', '')} · {p.volume}</span>
                  <b>{money(pl)}</b>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
