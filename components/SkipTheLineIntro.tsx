'use client';

import React, { useState } from 'react';

// Full-screen explainer shown the first time someone opens the Skip the Line
// tab. A few animated pages walk through how it works; tapping advances,
// Skip exits. Pure static text + CSS animation, same feel as MarketingIntro.

const C = {
  surface: '#f7f3ec',
  ink: '#2a2320',
  muted: '#8a7f70',
  terracotta: '#c8552b',
  green: '#3e7a4e',
  divider: '#e0d6c1',
};
const font = { serif: '"Zilla Slab", serif', sans: '"DM Sans", sans-serif' };

interface Page {
  kicker: string;
  title: string;
  body: string;
}

const PAGES: Page[] = [
  {
    kicker: 'SKIP THE LINE',
    title: 'Never stand in a food line again.',
    body: 'At stadiums, festivals, concerts, and your favorite local spots — the line is now digital.',
  },
  {
    kicker: 'HOW IT WORKS',
    title: 'Order from your seat.',
    body: 'Find the venue, browse every vendor’s menu, and place your order right from your phone.',
  },
  {
    kicker: 'THE MAGIC',
    title: 'We buzz you when it’s ready.',
    body: 'Watch the game. Enjoy the show. Your phone tells you the moment your food is up — walk over and grab it.',
  },
  {
    kicker: 'FOR BUSINESSES',
    title: 'Run a restaurant, booth, or festival?',
    body: 'Register your business, upload your permits, build your menu — and serve a line that never forms.',
  },
];

export default function SkipTheLineIntro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const OUT_MS = 380;

  const next = () => {
    if (leaving) return;
    if (index + 1 >= PAGES.length) {
      onDone();
      return;
    }
    setLeaving(true);
    setTimeout(() => {
      setIndex(i => i + 1);
      setLeaving(false);
    }, OUT_MS);
  };

  const page = PAGES[index];
  const animation = leaving
    ? `stlOut ${OUT_MS}ms cubic-bezier(.5,0,.75,.4) both`
    : 'stlIn 600ms cubic-bezier(.2,.9,.3,1) both';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: C.surface, display: 'flex', flexDirection: 'column', fontFamily: font.sans, overflow: 'hidden' }}>
      <style>{`
        @keyframes stlIn {
          from { opacity: 0; transform: translateY(28px) scale(.97); filter: blur(6px); }
          to   { opacity: 1; transform: none; filter: none; }
        }
        @keyframes stlOut {
          from { opacity: 1; transform: none; filter: none; }
          to   { opacity: 0; transform: translateY(-32px) scale(.98); filter: blur(4px); }
        }
        @keyframes stlRise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 0' }}>
        <div style={{ font: `500 24px/1 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>Plates</div>
        <button onClick={onDone} style={{ background: 'transparent', border: 'none', color: C.muted, font: `500 13px ${font.sans}`, cursor: 'pointer', padding: 6 }}>
          Skip →
        </button>
      </div>

      <div onClick={next} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center', cursor: 'pointer' }}>
        <div key={index} style={{ animation }}>
          <div style={{ font: `600 11px ${font.sans}`, color: C.green, letterSpacing: '.18em', marginBottom: 14 }}>{page.kicker}</div>
          <div style={{ font: `600 40px/1.12 ${font.serif}`, color: C.ink, letterSpacing: '-.01em' }}>{page.title}</div>
          <div style={{ font: `400 16px/1.55 ${font.sans}`, color: C.muted, marginTop: 18, maxWidth: 330, marginLeft: 'auto', marginRight: 'auto', animation: leaving ? undefined : 'stlRise 500ms 220ms cubic-bezier(.2,.9,.3,1) both' }}>
            {page.body}
          </div>
          <div style={{ marginTop: 34, animation: leaving ? undefined : 'stlRise 500ms 350ms cubic-bezier(.2,.9,.3,1) both' }}>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              style={{ padding: '13px 30px', background: C.ink, color: '#fff', border: 'none', borderRadius: 26, font: `500 15px ${font.sans}`, cursor: 'pointer' }}
            >
              {index + 1 >= PAGES.length ? "Let's eat" : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, justifyContent: 'center', paddingBottom: 34 }}>
        {PAGES.map((_, i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i <= index ? C.terracotta : C.divider, transition: 'background .3s' }} />
        ))}
      </div>
    </div>
  );
}
