'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  const login = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      loadAccounts();
    } else {
      setMessage('Contraseña incorrecta');
    }
  };

  const loadAccounts = async () => {
    const res = await fetch('/api/admin/accounts');
    if (res.ok) {
      const data = await res.json();
      setAccounts(data);
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

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-sm border border-white/20 p-6">
          <h1 className="text-xl font-bold mb-4">Panel de Administración</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña de admin"
            className="w-full px-3 py-2 mb-4"
          />
          <button onClick={login} className="w-full py-2 bg-white text-black">Entrar</button>
          {message && <p className="mt-2 text-sm text-red-400">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Administración ORZ Funding</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/20">
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Fase</th>
              <th className="text-left p-2">Estado</th>
              <th className="text-left p-2">MT5 Login</th>
              <th className="text-left p-2">Servidor</th>
              <th className="text-left p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id} className="border-b border-white/10">
                <td className="p-2">{acc.user.email}</td>
                <td className="p-2">{acc.phase}</td>
                <td className="p-2">{acc.status}</td>
                <td className="p-2">
                  <input
                    defaultValue={acc.mt5Login || ''}
                    onBlur={(e) => updateAccount(acc.id, { mt5Login: e.target.value })}
                    className="w-24 px-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    defaultValue={acc.mt5Server || ''}
                    onBlur={(e) => updateAccount(acc.id, { mt5Server: e.target.value })}
                    className="w-32 px-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    type="password"
                    placeholder="Pass inversionista"
                    onBlur={(e) => {
                      if (e.target.value) updateAccount(acc.id, { mt5InvestorPassword: e.target.value });
                    }}
                    className="w-32 px-1"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}