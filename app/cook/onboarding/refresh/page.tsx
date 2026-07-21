'use client';

import { useRouter } from 'next/navigation';

export default function OnboardingRefresh() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', background: '#fdfbf7' }}>
      <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #ece5d8', borderRadius: 16, padding: 32, boxShadow: '0 4px 16px rgba(60,40,20,.06)' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔄</div>
        <h1 style={{ font: '600 22px Georgia, serif', color: '#3a2e1f', margin: '0 0 10px' }}>
          Let&apos;s try that again
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: '#7a6f5f', margin: '0 0 24px' }}>
          Your setup link expired or didn&apos;t finish. No worries — head back and tap &quot;Connect payments&quot; to pick up where you left off.
        </p>
        <button
          onClick={() => router.push('/')}
          style={{ width: '100%', padding: 13, background: '#5a7d4f', color: '#fff', border: 'none', borderRadius: 10, font: '500 15px system-ui', cursor: 'pointer' }}
        >
          Back to Plates
        </button>
      </div>
    </div>
  );
}