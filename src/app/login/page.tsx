'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const sendCode = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('code');
        setMessage('Código enviado a tu correo. Revisa la bandeja (y spam).');
      } else {
        setMessage(data.error || 'Error');
      }
    } catch {
      setMessage('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/dashboard');
      } else {
        setMessage(data.error || 'Código incorrecto');
      }
    } catch {
      setMessage('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md border border-white/20 p-6 rounded">
        <h1 className="text-2xl font-bold mb-6 text-center">Acceso a Mi Cuenta</h1>
        {step === 'email' ? (
          <>
            <label className="block text-sm mb-2">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 mb-4"
              placeholder="tu@correo.com"
              required
            />
            <button
              onClick={sendCode}
              disabled={loading || !email}
              className="w-full py-2 bg-white text-black font-semibold"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm mb-4">Código enviado a {email}</p>
            <label className="block text-sm mb-2">Código de 6 dígitos</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-3 py-2 mb-4 text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
            />
            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="w-full py-2 bg-white text-black font-semibold"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
            <button
              onClick={() => setStep('email')}
              className="w-full mt-3 py-2 text-sm underline"
            >
              Cambiar correo
            </button>
          </>
        )}
        {message && <p className="mt-4 text-sm text-center">{message}</p>}
      </div>
    </div>
  );
}