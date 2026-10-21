'use client';

import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState('contactorzfunding@gmail.com');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState('');
  const [deleting, setDeleting] = useState('');

  const loadAccounts = async () => {
    const res = await fetch('/api/admin/accounts');
    if (res.ok) setAccounts(await res.json());
  };

  useEffect(() => {
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then(async (data) => {
        if (data.isAdmin) {
          setAuthenticated(true);
          await loadAccounts();
        }
        setReady(true);
      });
  }, []);

  const login = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      setMessage('');
      loadAccounts();
    } else {
      setMessage('Correo o contraseña incorrectos');
    }
  };

  const createUser = async () => {
    setCreating(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, isFounder: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewEmail('');
        setMessage('Cliente creado. Ya puede pedir código.');
        loadAccounts();
      } else setMessage(data.error || 'Error');
    } finally {
      setCreating(false);
    }
  };

  const updateAccount = async (id: string, data: any) => {
    await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...data }),
    });
    loadAccounts();
  };

  const connectMeta = async (id: string) => {
    setConnecting(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/metaapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('MetaApi conectado. En unos minutos se ven las métricas.');
        loadAccounts();
      } else setMessage(data.error || 'Error');
    } finally {
      setConnecting('');
    }
  };

  const removeAccount = async (id: string, mail: string) => {
    if (!confirm(`Borrar la cuenta de ${mail}? No se puede deshacer.`)) return;
    setDeleting(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMessage('Cuenta borrada.');
        loadAccounts();
      } else setMessage('No se pudo borrar');
    } finally {
      setDeleting('');
    }
  };

  if (!ready) return <div className="page"><p className="lead">Cargando...</p></div>;

  if (!authenticated) {
    return (
      <div className="gate">
        <div className="sheet">
          <p className="kicker">ORZ Funding</p>
          <h1>Panel</h1>
          <p className="lead">Solo el dueño.</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" />
          <button className="btn" onClick={login}>Entrar</button>
          {message && <p className="note">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page admin">
      <p className="kicker">Cuenta de dueño</p>
      <h1>Panel</h1>
      <p className="lead">{accounts.length} cuenta{accounts.length === 1 ? '' : 's'}</p>

      <section className="card">
        <h2>Dar de alta</h2>
        <div className="row">
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="correo@cliente.com" />
          <button className="btn" onClick={createUser} disabled={creating || !newEmail}>{creating ? 'Creando...' : 'Crear'}</button>
        </div>
        {message && <p className="note" style={{ textAlign: 'left' }}>{message}</p>}
      </section>

      {accounts.length === 0 && <p className="lead">Todavía no hay cuentas.</p>}

      {accounts.map((acc) => (
        <section className="card client" key={acc.id}>
          <div className="client-top">
            <div>
              <p className="kicker">{acc.user.isFounder ? 'Fundador' : 'Cliente'} · Fase {acc.phase}</p>
              <h2>{acc.user.email}</h2>
            </div>
            <span className="badge">{acc.status}</span>
          </div>
          <div className="fields">
            <label>Estado
              <select defaultValue={acc.status} onChange={(e) => updateAccount(acc.id, { status: e.target.value })}>
                <option value="active">En progreso</option>
                <option value="aprobada">Aprobada</option>
                <option value="fondeada">Fondeada</option>
                <option value="suspendida">Suspendida</option>
                <option value="reprobada">Reprobada</option>
                <option value="pendiente">Pendiente</option>
              </select>
            </label>
            <label>Login MT5<input defaultValue={acc.mt5Login || ''} onBlur={(e) => updateAccount(acc.id, { mt5Login: e.target.value })} /></label>
            <label>Servidor<input defaultValue={acc.mt5Server || ''} onBlur={(e) => updateAccount(acc.id, { mt5Server: e.target.value })} placeholder="PepperstoneGmbH-Demo" /></label>
            <label>Contraseña de inversionista<input type="password" placeholder="Solo si la cambias" onBlur={(e) => { if (e.target.value) updateAccount(acc.id, { mt5InvestorPassword: e.target.value }); }} /></label>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => connectMeta(acc.id)} disabled={connecting === acc.id}>
              {connecting === acc.id ? 'Conectando...' : acc.metaapiAccountId ? 'Reconectar' : 'Conectar MetaApi'}
            </button>
            <button className="btn line" onClick={() => removeAccount(acc.id, acc.user.email)} disabled={deleting === acc.id}>
              {deleting === acc.id ? 'Borrando...' : 'Borrar cuenta'}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
