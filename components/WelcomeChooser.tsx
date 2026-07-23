'use client';

import React, { useState } from 'react';

// Welcome fork for signed-in users, shown while the app boots underneath.
// Two stacked animated questions: "Ready to cook?" routes to the kitchen,
// "Can we fix you a plate?" routes to the home feed. Pure static text + CSS
// (same construction as MarketingIntro) so it paints instantly.
//
// `ready` tells the component whether the app has finished loading. A tap
// before that shows a "Setting the table…" note; the parent routes the
// moment data arrives.

const C = {
  surface: '#f7f3ec',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  terracotta: '#c8552b',
  green: '#3d6b47',
  divider: '#e0d6c1',
};
const font = { serif: '"Zilla Slab", serif', sans: '"DM Sans", sans-serif' };

export default function WelcomeChooser({
  ready,
  onChoose,
}: {
  ready: boolean;
  onChoose: (dest: 'kitchen' | 'feed') => void;
}) {
  const [chosen, setChosen] = useState<'kitchen' | 'feed' | null>(null);

  const pick = (dest: 'kitchen' | 'feed') => {
    if (chosen) return;
    setChosen(dest);
    onChoose(dest);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: C.surface, display: 'flex', flexDirection: 'column', fontFamily: font.sans, overflow: 'hidden' }}>
      <style>{`
        @keyframes plWelcomeIn {
          from { opacity: 0; transform: translateY(26px) scale(.97); filter: blur(6px); }
          to   { opacity: 1; transform: none; filter: none; }
        }
        @keyframes plWelcomePulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
      `}</style>

      <div style={{ padding: '20px 22px 0', textAlign: 'center' }}>
        <div style={{ font: `500 24px/1 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>Plates</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center', gap: 34 }}>
        {/* Question 1: the cook path */}
        <div style={{ animation: 'plWelcomeIn 600ms cubic-bezier(.2,.9,.3,1) both' }}>
          <div style={{ font: `600 38px/1.1 ${font.serif}`, color: C.ink, letterSpacing: '-.01em' }}>
            Ready to cook?
          </div>
          <button
            onClick={() => pick('kitchen')}
            disabled={chosen !== null}
            style={{ marginTop: 18, padding: '13px 30px', background: chosen === 'kitchen' ? C.ink : C.green, color: '#fff', border: 'none', borderRadius: 26, font: `500 15px ${font.sans}`, cursor: 'pointer', opacity: chosen && chosen !== 'kitchen' ? .4 : 1 }}
          >
            {chosen === 'kitchen' ? 'Opening your kitchen…' : 'Yes'}
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 180, animation: 'plWelcomeIn 600ms 200ms cubic-bezier(.2,.9,.3,1) both' }}>
          <span style={{ flex: 1, height: 1, background: C.divider }} />
          <span style={{ font: `500 12px ${font.sans}`, color: C.muted }}>or</span>
          <span style={{ flex: 1, height: 1, background: C.divider }} />
        </div>

        {/* Question 2: the eat path */}
        <div style={{ animation: 'plWelcomeIn 600ms 350ms cubic-bezier(.2,.9,.3,1) both' }}>
          <div style={{ font: `600 38px/1.1 ${font.serif}`, color: C.ink, letterSpacing: '-.01em' }}>
            Can we fix you a plate?
          </div>
          <button
            onClick={() => pick('feed')}
            disabled={chosen !== null}
            style={{ marginTop: 18, padding: '13px 30px', background: chosen === 'feed' ? C.ink : C.terracotta, color: '#fff', border: 'none', borderRadius: 26, font: `500 15px ${font.sans}`, cursor: 'pointer', opacity: chosen && chosen !== 'feed' ? .4 : 1 }}
          >
            {chosen === 'feed' ? 'Fixing your plate…' : 'Yes'}
          </button>
        </div>
      </div>

      <div style={{ paddingBottom: 30, textAlign: 'center', minHeight: 50 }}>
        {chosen && !ready && (
          <div style={{ font: `500 13px ${font.sans}`, color: C.muted, animation: 'plWelcomePulse 1.4s ease-in-out infinite' }}>
            Setting the table…
          </div>
        )}
      </div>
    </div>
  );
}
