'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingComplete() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ready' | 'pending'>('checking');

  useEffect(() => {
    // On return from Stripe, sync the account status directly from Stripe.
    (async () => {
      try {
        const res = await fetch('/api/stripe/refresh-account', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.chargesEnabled) {
          setStatus('ready');
        } else {
          setStatus('pending');
        }
      } catch {
        setStatus('pending');
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#fdfbf7' }}>
      <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #ece5d8', borderRadius: 16, padding: 32, boxShadow: '0 4px 16px rgba(60,40,20,.06)' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>
          {status === 'checking' ? '⏳' : status === 'ready' ? '🎉' : '✅'}
        </div>
        <h1 style={{ font: '600 22px Georgia, serif', color: '#3a2e1f', margin: '0 0 10px' }}>
          {status === 'checking' ? 'Confirming your setup…' : status === 'ready' ? 'You\u2019re all set!' : 'Payment details submitted'}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#7a6f5f', margin: '0 0 24px' }}>
          {status === 'checking'
            ? 'Just a moment while we confirm your payment setup with Stripe.'
            : status === 'ready'
            ? 'Your payment account is active. You can start receiving orders now.'
            : 'Thanks! Stripe is still verifying your details. This can take a few minutes — your kitchen will update automatically once you\u2019re approved.'}
        </p>
        <button
          onClick={() => router.push('/')}
          disabled={status === 'checking'}
          style={{ width: '100%', padding: 13, background: '#5a7d4f', color: '#fff', border: 'none', borderRadius: 10, font: '500 15px system-ui', cursor: status === 'checking' ? 'default' : 'pointer', opacity: status === 'checking' ? 0.6 : 1 }}
        >
          {status === 'checking' ? 'Please wait…' : 'Back to Plates'}
        </button>
      </div>
    </div>
  );
}