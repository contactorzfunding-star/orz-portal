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
        setMessage('Código enviado. Revisa el correo y spam.');
      } else setMessage(data.error || 'Error');
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
      if (res.ok) router.push('/dashboard');
      else setMessage(data.error || 'Código incorrecto');
    } catch {
      setMessage('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gate">
      <div className="sheet">
        <p className="kicker">ORZ Funding</p>
        <h1>Mi cuenta</h1>
        {step === 'email' ? (
          <>
            <p className="lead">Escribe el correo de tu compra. Te enviamos un código.</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
            <button onClick={sendCode} disabled={loading || !email} className="btn">{loading ? 'Enviando...' : 'Enviar código'}</button>
          </>
        ) : (
          <>
            <p className="lead">Código enviado a {email}</p>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="code" maxLength={6} />
            <button onClick={verifyCode} disabled={loading || code.length !== 6} className="btn">{loading ? 'Verificando...' : 'Entrar'}</button>
            <button onClick={() => setStep('email')} className="btn line">Cambiar correo</button>
          </>
        )}
        {message && <p className="note">{message}</p>}
      </div>
    </div>
  );
}
