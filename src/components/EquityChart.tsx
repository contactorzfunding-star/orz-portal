'use client';

export function EquityChart({
  points,
  initial,
  goal,
}: {
  points: { t: string; v: number }[];
  initial: number;
  goal: number;
}) {
  const w = 760;
  const h = 280;
  const pad = 28;
  const goalValue = initial * (1 + goal);
  const daily = initial * 0.95;
  const max = initial * 0.9;
  const values = points.map((p) => p.v).concat([initial, goalValue, daily, max]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV || 1;

  const x = (i: number) => pad + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (w - pad * 2));
  const y = (v: number) => pad + ((maxV - v) / span) * (h - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label="Curva de equity">
      <line x1={pad} y1={y(goalValue)} x2={w - pad} y2={y(goalValue)} className="guide goal" />
      <line x1={pad} y1={y(daily)} x2={w - pad} y2={y(daily)} className="guide daily" />
      <line x1={pad} y1={y(max)} x2={w - pad} y2={y(max)} className="guide loss" />
      <path d={d} className="curve" />
      {points.map((p, i) => (
        <circle key={p.t + i} cx={x(i)} cy={y(p.v)} r="3" className="dot" />
      ))}
    </svg>
  );
}
