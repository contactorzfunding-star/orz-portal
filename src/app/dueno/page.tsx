'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const enter = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) router.push('/admin');
      else setMessage('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gate">
      <div className="sheet">
        <p className="kicker">ORZ Funding</p>
        <h1>Cuenta de dueño</h1>
        <p className="lead">Solo el dueño. Aquí está el panel.</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo del dueño" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" />
        <button className="btn" onClick={enter} disabled={loading || !email || !password}>{loading ? 'Entrando...' : 'Entrar'}</button>
        {message && <p className="note">{message}</p>}
      </div>
    </div>
  );
}
