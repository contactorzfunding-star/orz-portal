'use client';

import { useState } from 'react';

export function NameForm({ initial }: { initial?: string | null }) {
  const [name, setName] = useState(initial || '');
  const [saved, setSaved] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!initial);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value.length < 2) return;
    setBusy(true);
    const res = await fetch('/api/name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: value }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(value);
      setEditing(false);
    }
  }

  if (!editing && saved) {
    return (
      <>
        <h1>{saved}</h1>
        <button type="button" className="btn line" style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }} onClick={() => setEditing(true)}>
          Cambiar nombre
        </button>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ marginTop: 8 }}>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Nombre completo
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellidos"
          autoComplete="name"
          required
          style={{
            display: 'block',
            width: '100%',
            marginTop: 6,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,.3)',
            color: '#fff',
            padding: 12,
            borderRadius: 10,
          }}
        />
      </label>
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Guardando...' : 'Guardar nombre'}
      </button>
    </form>
  );
}
