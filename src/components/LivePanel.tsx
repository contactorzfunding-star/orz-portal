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
  positions: Position[];
};

export function LivePanel({
  initialBalance,
  initialEquity,
  initialStart,
  initialPositions,
}: {
  initialBalance: number;
  initialEquity: number;
  initialStart: number;
  initialPositions: Position[];
}) {
  const [data, setData] = useState<Live>({
    balance: initialBalance,
    equity: initialEquity,
    initial: initialStart,
    positions: initialPositions,
  });

  useEffect(() => {
    let on = true;
    let source: EventSource | null = null;

    function connect() {
      source = new EventSource('/api/live/stream');
      source.onmessage = (e) => {
        if (!on) return;
        try {
          const json = JSON.parse(e.data);
          setData(json);
        } catch {
          // ignora
        }
      };
      source.onerror = () => {
        source?.close();
        if (on) setTimeout(connect, 1000);
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

  return (
    <>
      <div className="grid">
        <div className="tile"><span>Balance inicial</span><b>{money(data.initial)}</b></div>
        <div className="tile"><span>Balance</span><b>{money(data.balance)}</b></div>
        <div className="tile"><span>Equity</span><b>{money(data.equity)}</b></div>
      </div>

      <section className="card">
        <h2>En vivo</h2>
        <p>Ganancia cerrada: {profit >= 0 ? '+' : ''}{money(profit)} ({pct.toFixed(2)}%)</p>
        <p>Flotante: {floating >= 0 ? '+' : ''}{money(floating)}</p>
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
