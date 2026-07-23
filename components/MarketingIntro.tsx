'use client';

import React, { useState } from 'react';

// Full-screen marketing intro for first-time visitors. Pure static text +
// CSS animation — no data fetching — so it paints instantly while the app
// boots underneath. Each beat: a big question animates in, the visitor taps
// an answer, the question animates out and a punchline statement takes its
// place, then the next beat begins. After the last beat the intro hands off
// to the homepage via onDone.

const C = {
  surface: '#f7f3ec',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  terracotta: '#c8552b',
  divider: '#e0d6c1',
};
const font = { serif: '"Zilla Slab", serif', sans: '"DM Sans", sans-serif' };

interface Beat {
  question: string;
  answers: { label: string; statement: string }[];
}

const BEATS: Beat[] = [
  {
    question: 'Can you cook?',
    answers: [
      { label: 'Yes', statement: 'Start selling Plates.' },
      { label: 'Not really', statement: 'Good news — your neighbors can.' },
    ],
  },
  {
    question: 'Hate lines?',
    answers: [
      { label: 'Absolutely', statement: 'Use Plates.' },
      { label: 'Kind of', statement: 'Use Plates anyway.' },
    ],
  },
];

const OUT_MS = 420;      // exit animation length
const STATEMENT_MS = 1700; // how long the punchline holds

export default function MarketingIntro({ onDone }: { onDone: () => void }) {
  const [beatIndex, setBeatIndex] = useState(0);
  const [phase, setPhase] = useState<'question' | 'statement'>('question');
  const [statement, setStatement] = useState('');
  const [leaving, setLeaving] = useState(false);

  const beat = BEATS[beatIndex];

  const pickAnswer = (chosen: { statement: string }) => {
    if (leaving || phase !== 'question') return;
    setLeaving(true);
    setTimeout(() => {
      setStatement(chosen.statement);
      setPhase('statement');
      setLeaving(false);
      setTimeout(() => {
        setLeaving(true);
        setTimeout(() => {
          if (beatIndex + 1 < BEATS.length) {
            setBeatIndex(beatIndex + 1);
            setPhase('question');
            setLeaving(false);
          } else {
            onDone();
          }
        }, OUT_MS);
      }, STATEMENT_MS);
    }, OUT_MS);
  };

  const animation = leaving
    ? `plIntroOut ${OUT_MS}ms cubic-bezier(.5,0,.75,.4) both`
    : 'plIntroIn 600ms cubic-bezier(.2,.9,.3,1) both';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: C.surface, display: 'flex', flexDirection: 'column', fontFamily: font.sans, overflow: 'hidden' }}>
      <style>{`
        @keyframes plIntroIn {
          from { opacity: 0; transform: translateY(28px) scale(.97); filter: blur(6px); }
          to   { opacity: 1; transform: none; filter: none; }
        }
        @keyframes plIntroOut {
          from { opacity: 1; transform: none; filter: none; }
          to   { opacity: 0; transform: translateY(-32px) scale(.98); filter: blur(4px); }
        }
        @keyframes plIntroRise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>

      {/* Header: wordmark + skip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 0' }}>
        <div style={{ font: `500 24px/1 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>Plates</div>
        <button onClick={onDone} style={{ background: 'transparent', border: 'none', color: C.muted, font: `500 13px ${font.sans}`, cursor: 'pointer', padding: 6 }}>
          Skip →
        </button>
      </div>

      {/* Centered beat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 30px', textAlign: 'center' }}>
        {phase === 'question' ? (
          <div key={`q-${beatIndex}`} style={{ animation }}>
            <div style={{ font: `600 46px/1.1 ${font.serif}`, color: C.ink, letterSpacing: '-.01em' }}>
              {beat.question}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 34, animation: leaving ? undefined : 'plIntroRise 500ms 250ms cubic-bezier(.2,.9,.3,1) both' }}>
              {beat.answers.map(a => (
                <button
                  key={a.label}
                  onClick={() => pickAnswer(a)}
                  style={{ padding: '13px 26px', background: C.ink, color: '#fff', border: 'none', borderRadius: 26, font: `500 15px ${font.sans}`, cursor: 'pointer' }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div key={`s-${beatIndex}`} style={{ animation }}>
            <div style={{ font: `600 44px/1.15 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>
              {statement}
            </div>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 7, justifyContent: 'center', paddingBottom: 34 }}>
        {BEATS.map((_, i) => (
          <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i <= beatIndex ? C.terracotta : C.divider, transition: 'background .3s' }} />
        ))}
      </div>
    </div>
  );
}
