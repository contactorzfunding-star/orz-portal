'use client';

import { useEffect, useState } from 'react';

const WHATSAPP = 'https://wa.me/525562133717?text=' + encodeURIComponent('Hola, quiero solicitar mi retiro de ORZ Funding.');

function nextMonday(from = new Date()) {
  const d = new Date(from);
  const day = d.getDay();
  const add = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWait(ms: number) {
  if (ms <= 0) return 'ya puedes solicitar';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days} día${days === 1 ? '' : 's'} y ${hours} h`;
  return `${hours} h`;
}

export function Withdrawal({ enabled, userId }: { enabled: boolean; userId: string }) {
  const [last, setLast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    try {
      setLast(localStorage.getItem(`orz-retiro-${userId}`));
    } catch {}
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [userId]);

  const lastDate = last ? new Date(last) : null;
  const canRequest = !lastDate || now >= nextMonday(lastDate).getTime();
  const wait = lastDate ? nextMonday(lastDate).getTime() - now : 0;

  function request() {
    if (!canRequest) return;
    try {
      localStorage.setItem(`orz-retiro-${userId}`, new Date().toISOString());
    } catch {}
    setLast(new Date().toISOString());
    window.open(WHATSAPP, '_blank', 'noopener');
  }

  if (!enabled) {
    return (
      <section className="card">
        <h2>Retiro</h2>
        <p style={{ color: 'rgba(255,255,255,.65)' }}>
          Esta zona se habilita cuando la cuenta está aprobada o fondeada. Mientras estás en evaluación, el retiro no está disponible.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Retiro</h2>
      <p>Los retiros son semanales. Si solicitas un lunes, el siguiente se habilita el lunes siguiente.</p>
      {canRequest ? (
        <>
          <p>Puedes solicitar tu retiro esta semana.</p>
          <button className="btn" type="button" onClick={request}>
            Solicitar por WhatsApp
          </button>
        </>
      ) : (
        <>
          <p>Ya solicitaste esta semana. Podrás volver a pedir en {formatWait(wait)}.</p>
          <button className="btn line" type="button" disabled style={{ opacity: 0.5 }}>
            Disponible el próximo lunes
          </button>
        </>
      )}
    </section>
  );
}
