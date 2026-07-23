'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Star, Share2, ChefHat } from 'lucide-react';

// Public landing page for a shared dish. Anyone can view it (no auth);
// "Order on Plates" deep-links into the app via /?dish=<id>.

const C = {
  page: '#eae4d9',
  surface: '#f7f3ec',
  card: '#fdfbf6',
  cardAlt: '#efe8db',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  terracotta: '#c8552b',
  terracottaLight: '#f6e2d5',
  green: '#3d6b47',
  greenLight: '#dfe8dd',
  gold: '#b8860b',
  divider: '#e0d6c1',
};
const font = { serif: 'Zilla Slab, serif', sans: 'DM Sans, sans-serif' };

interface PublicDish {
  id: number;
  name: string;
  description: string | null;
  price: string | number;
  emoji: string;
  photo_url: string | null;
  is_catering: boolean | null;
  sides: string | null;
  likes: number;
  avg_rating: number | string | null;
  review_count: number;
  seller_id: number;
  seller_name: string;
  seller_kitchen_name: string | null;
  seller_avatar: string;
  seller_photo_url: string | null;
}

export default function MealShareView({ dish }: { dish: PublicDish }) {
  const [copied, setCopied] = useState(false);
  const cookName = dish.seller_kitchen_name || dish.seller_name;

  const share = async () => {
    const url = `${window.location.origin}/meal/${dish.id}`;
    const data = {
      title: `${dish.name} on Plates`,
      text: `${dish.name} from ${cookName} — homemade, made to order.`,
      url,
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* user dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard unavailable */ }
    }
  };

  return (
    <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
      <div style={{ maxWidth: 430, margin: '0 auto', background: C.surface, minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink, textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{ flex: 1, font: `500 22px ${font.serif}`, color: C.terracotta }}>Plates</div>
          <button onClick={share} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink, border: 'none', cursor: 'pointer' }}>
            <Share2 size={16} />
          </button>
        </div>
        {copied && (
          <div style={{ padding: '0 20px', textAlign: 'right', font: `500 11px ${font.sans}`, color: C.green }}>Link copied!</div>
        )}

        {/* Photo */}
        <div style={{ padding: '12px 20px 0' }}>
          {dish.photo_url ? (
            <div style={{ width: '100%', height: 260, borderRadius: 18, backgroundImage: `url(${dish.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          ) : (
            <div style={{ width: '100%', height: 260, borderRadius: 18, background: 'repeating-linear-gradient(45deg,#ece3d5,#ece3d5 9px,#f2ebde 9px,#f2ebde 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>{dish.emoji}</div>
          )}
        </div>

        {/* Title + price */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ font: `600 26px/1.1 ${font.serif}`, color: C.ink }}>{dish.name}</div>
            <div style={{ font: `600 26px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(dish.price).toFixed(0)}</div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {dish.review_count > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: `500 12.5px ${font.sans}`, color: C.ink }}>
                <Star size={13} fill={C.gold} color={C.gold} /> {Number(dish.avg_rating || 0).toFixed(1)}
                <span style={{ color: C.muted, fontWeight: 400 }}>({dish.review_count})</span>
              </span>
            )}
            <span style={{ background: C.cardAlt, color: C.inkSoft, padding: '5px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>Homemade</span>
            {dish.is_catering && (
              <span style={{ background: C.green, color: '#fff', padding: '5px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>Catering · order ahead</span>
            )}
            <span style={{ background: C.terracottaLight, color: C.terracotta, padding: '5px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>♥ {dish.likes}</span>
          </div>

          {dish.description && (
            <div style={{ font: `400 14px/1.6 ${font.sans}`, color: C.inkSoft, marginTop: 14 }}>{dish.description}</div>
          )}

          {(dish.sides || '').trim() && (
            <div style={{ font: `400 12.5px ${font.sans}`, color: C.muted, marginTop: 10 }}>
              Side options: {dish.sides}
            </div>
          )}
        </div>

        {/* Cook card */}
        <div style={{ padding: '18px 20px 0' }}>
          <Link href={`/cook/${dish.seller_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: C.card, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              {dish.seller_photo_url ? (
                <span style={{ width: 44, height: 44, borderRadius: '50%', backgroundImage: `url(${dish.seller_photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
              ) : (
                <span style={{ width: 44, height: 44, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 16px ${font.sans}`, flex: 'none' }}>{dish.seller_avatar}</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>{cookName}</div>
                <div style={{ font: `400 12px ${font.sans}`, color: C.muted, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <ChefHat size={12} /> View kitchen & menu
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* CTA */}
        <div style={{ padding: '18px 20px 30px' }}>
          <Link href={`/?dish=${dish.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: C.terracotta, color: '#fff', borderRadius: 14, padding: 15, textAlign: 'center', font: `500 15px ${font.sans}` }}>
              Order on Plates
            </div>
          </Link>
          <div style={{ textAlign: 'center', font: `400 11.5px ${font.sans}`, color: C.muted, marginTop: 10 }}>
            Homemade meals from local cooks · pickup nearby
          </div>
        </div>
      </div>
    </div>
  );
}
