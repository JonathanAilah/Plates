'use client';

import React, { useEffect, useState } from 'react';

// The vendor-facing menu form behind /vendor-form/<token>. Loads the invite
// (vendor + venue names), lets the vendor add menu rows, and submits them
// into that vendor's tab on the venue's Skip the Line menu.

const C = {
  page: '#f7f3ec',
  card: '#fffdf8',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  terracotta: '#c8552b',
  green: '#3e7a4e',
  greenLight: '#e6efe2',
  divider: '#e0d6c1',
};
const font = { serif: '"Zilla Slab", serif', sans: '"DM Sans", sans-serif' };

interface Row { name: string; price: string; description: string }

export default function VendorMenuForm({ token }: { token: string }) {
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([{ name: '', price: '', description: '' }]);
  const [about, setAbout] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/stl/form?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'This link is not valid');
        setInvite(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (submitting) return;
    const items = rows
      .map(r => ({ name: r.name.trim(), price: parseFloat(r.price) || 0, description: r.description.trim() || null }))
      .filter(r => r.name && r.price > 0);
    if (items.length === 0) {
      setError('Add at least one item with a name and price');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/stl/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, items, vendorDescription: about.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit');
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: C.page, fontFamily: font.sans, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, padding: '28px 22px 60px' }}>
        <div style={{ font: `500 24px/1 ${font.serif}`, color: C.terracotta, marginBottom: 24 }}>Plates · Skip the Line</div>
        {children}
      </div>
    </div>
  );

  if (loading) return shell(<div style={{ color: C.muted, font: `400 14px ${font.sans}` }}>Loading…</div>);

  if (error && !invite) return shell(
    <div style={{ background: C.card, borderRadius: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ font: `500 18px ${font.serif}`, color: C.ink, marginBottom: 8 }}>This link isn&apos;t valid</div>
      <div style={{ font: `400 13.5px ${font.sans}`, color: C.muted }}>{error}</div>
    </div>
  );

  if (done || invite?.submitted_at) return shell(
    <div style={{ background: C.greenLight, borderRadius: 16, padding: 28, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
      <div style={{ font: `500 20px ${font.serif}`, color: C.green, marginBottom: 8 }}>Menu received!</div>
      <div style={{ font: `400 14px/1.5 ${font.sans}`, color: C.inkSoft }}>
        {done
          ? <>Your menu is now live under <b>{invite.vendor_name}</b>{invite.venue_name ? <> at <b>{invite.venue_name}</b></> : null}. Event-goers can browse it on Plates and skip your line.</>
          : 'This menu form was already submitted. Ask the event organizer for a new link if something needs to change.'}
      </div>
    </div>
  );

  return shell(
    <>
      <div style={{ background: C.card, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
        <div style={{ font: `600 22px/1.2 ${font.serif}`, color: C.ink, marginBottom: 6 }}>
          Build the menu for {invite.vendor_name}
        </div>
        <div style={{ font: `400 13.5px/1.5 ${font.sans}`, color: C.muted }}>
          {invite.venue_name ? <>You&apos;re listed as a vendor at <b style={{ color: C.inkSoft }}>{invite.venue_name}</b>. </> : null}
          Add what you sell below — customers will order from their phones and get a ping when it&apos;s ready, so your line stays short.
        </div>
      </div>

      <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>About your food (optional)</div>
      <textarea
        value={about}
        onChange={e => setAbout(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="e.g. Wood-fired pizza, made to order"
        style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 12, font: `400 14px/1.5 ${font.sans}`, background: '#fff', resize: 'none', marginBottom: 16, fontFamily: font.sans }}
      />

      <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>Menu items</div>
      {rows.map((row, i) => (
        <div key={i} style={{ background: C.card, borderRadius: 12, padding: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              type="text"
              value={row.name}
              onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
              placeholder={`Item ${i + 1}, e.g. Brisket sandwich`}
              style={{ flex: 1, minWidth: 0, padding: 11, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
              <span style={{ font: `400 13px ${font.sans}`, color: C.muted }}>$</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={row.price}
                onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, price: e.target.value } : r))}
                placeholder="0"
                style={{ width: 74, padding: 11, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff' }}
              />
            </div>
            {rows.length > 1 && (
              <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))} style={{ flex: 'none', width: 30, background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
            )}
          </div>
          <input
            type="text"
            value={row.description}
            onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, description: e.target.value } : r))}
            placeholder="Short description (optional)"
            style={{ width: '100%', padding: 10, border: `1px solid ${C.divider}`, borderRadius: 10, font: `400 13px ${font.sans}`, background: '#fff' }}
          />
        </div>
      ))}

      {rows.length < 60 && (
        <button
          onClick={() => setRows(prev => [...prev, { name: '', price: '', description: '' }])}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#efe8da', color: C.inkSoft, border: 'none', borderRadius: 10, font: `500 13px ${font.sans}`, cursor: 'pointer', marginBottom: 16 }}
        >
          + Add another item
        </button>
      )}

      {error && (
        <div style={{ background: '#fceded', color: '#8a2a2a', borderRadius: 10, padding: 12, font: `400 13px ${font.sans}`, marginBottom: 12 }}>{error}</div>
      )}

      <button
        onClick={submit}
        disabled={submitting}
        style={{ width: '100%', padding: 15, background: submitting ? '#efe8da' : C.terracotta, color: submitting ? C.muted : '#fff', border: 'none', borderRadius: 14, font: `500 15px ${font.sans}`, cursor: 'pointer' }}
      >
        {submitting ? 'Sending…' : 'Submit menu'}
      </button>
      <div style={{ font: `400 11.5px/1.5 ${font.sans}`, color: C.muted, marginTop: 10, textAlign: 'center' }}>
        Submitting adds your menu to the event&apos;s Skip the Line page on Plates. This link works once.
      </div>
    </>
  );
}
