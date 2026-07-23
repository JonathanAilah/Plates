'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Star, MapPin, Heart, MessageCircle, ChefHat, Share2 } from 'lucide-react';

// Design tokens — same as main app
const C = {
  page: '#eae4d9',
  surface: '#f7f3ec',
  card: '#fdfbf6',
  cardAlt: '#efe8db',
  hairline: '#e4dcc9',
  ink: '#2a2320',
  inkSoft: '#4a4038',
  muted: '#8a7f70',
  mutedLight: '#b8ac9a',
  terracotta: '#c8552b',
  terracottaLight: '#f6e2d5',
  green: '#3d6b47',
  greenLight: '#dfe8dd',
  gold: '#b8860b',
  divider: '#e0d6c1',
};
const font = { serif: 'Zilla Slab, serif', sans: 'DM Sans, sans-serif' };

interface CookProfileData {
  cook: {
    id: number;
    name: string;
    avatar: string;
    photo_url: string | null;
    bio: string | null;
    kitchen_name: string | null;
    pickup_description: string | null;
    kitchen_flags: string | null;
    latitude: number | null;
    longitude: number | null;
    prep_address: string | null;
    created_at: string;
  };
  dishes: Array<{
    id: number;
    name: string;
    description: string | null;
    price: string | number;
    emoji: string;
    photo_url: string | null;
    likes: number;
    is_featured: boolean;
    avg_rating: number | string | null;
    review_count: number;
    created_at: string;
  }>;
  cateringDishes?: Array<{
    id: number;
    name: string;
    description: string | null;
    price: string | number;
    emoji: string;
    photo_url: string | null;
    likes: number;
    is_featured: boolean;
    avg_rating: number | string | null;
    review_count: number;
    created_at: string;
  }>;
  aggregateRating: { avg: number | null; count: number };
  posts: Array<{
    id: number;
    body: string;
    photo_url: string | null;
    created_at: string;
    expires_at: string;
    heart_count: number;
    fire_count: number;
    hands_count: number;
    comment_count: number;
  }>;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function memberSince(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Native share sheet on phones, copy-link fallback on desktop
function ShareButton({ name, cookId }: { name: string; cookId: number }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}/cook/${cookId}`;
    const data = { title: `${name} on Plates`, text: `Homemade meals from ${name} — order on Plates.`, url };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard unavailable */ }
    }
  };
  return (
    <button onClick={share} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink, border: 'none', cursor: 'pointer', position: 'relative' }}>
      <Share2 size={16} />
      {copied && (
        <span style={{ position: 'absolute', top: 40, right: 0, background: C.ink, color: '#fff', padding: '4px 10px', borderRadius: 8, font: `500 11px ${font.sans}`, whiteSpace: 'nowrap' }}>Link copied!</span>
      )}
    </button>
  );
}

export default function CookProfileView({ profile }: { profile: CookProfileData }) {
  const { cook, dishes, aggregateRating, posts } = profile;
  const cateringDishes = profile.cateringDishes || [];
  const displayName = cook.kitchen_name || cook.name;
  const kitchenFlags = (cook.kitchen_flags || '').split(',').map(f => f.trim()).filter(Boolean);

  return (
    <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
      <div style={{ maxWidth: 430, margin: '0 auto', background: C.surface, minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink, textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div style={{ flex: 1, font: `500 22px ${font.serif}`, color: C.ink }}>Cook</div>
          <ShareButton name={displayName} cookId={cook.id} />
        </div>

        {/* Cook card */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ background: C.card, borderRadius: 20, padding: '20px 18px', boxShadow: '0 3px 14px rgba(60,40,20,.08)' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {cook.photo_url ? (
                <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundImage: `url(${cook.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center', flex: 'none' }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 26px ${font.sans}`, flex: 'none' }}>{cook.avatar}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `500 20px/1.15 ${font.serif}`, color: C.ink }}>{displayName}</div>
                {cook.kitchen_name && cook.name !== cook.kitchen_name && (
                  <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginTop: 3 }}>by {cook.name}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {aggregateRating.count > 0 ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: `500 12.5px ${font.sans}`, color: C.ink }}>
                      <Star size={13} fill={C.gold} color={C.gold} />
                      {aggregateRating.avg?.toFixed(1)}
                      <span style={{ color: C.muted, fontWeight: 400 }}> · {aggregateRating.count} review{aggregateRating.count === 1 ? '' : 's'}</span>
                    </span>
                  ) : (
                    <span style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>No reviews yet</span>
                  )}
                </div>
                <div style={{ font: `400 10.5px ${font.sans}`, color: C.muted, marginTop: 3 }}>
                  Cooking on Plates since {memberSince(cook.created_at)}
                </div>
              </div>
            </div>

            {cook.bio && (
              <div style={{ font: `400 13.5px/1.5 ${font.sans}`, color: C.inkSoft, marginTop: 14, whiteSpace: 'pre-wrap' }}>
                {cook.bio}
              </div>
            )}

            {kitchenFlags.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
                {kitchenFlags.map(flag => (
                  <span key={flag} style={{ background: C.surface, color: C.inkSoft, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>
                    {flag}
                  </span>
                ))}
              </div>
            )}

            {cook.pickup_description && (
              <div style={{ marginTop: 12, padding: 10, background: C.surface, borderRadius: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <MapPin size={14} color={C.muted} style={{ marginTop: 2, flex: 'none' }} />
                <div style={{ font: `400 12.5px/1.4 ${font.sans}`, color: C.inkSoft }}>{cook.pickup_description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Menu */}
        <div style={{ padding: '22px 20px 0' }}>
          <div style={{ font: `500 16px ${font.serif}`, color: C.ink, marginBottom: 10 }}>
            {displayName.endsWith('s') ? `${displayName}'` : `${displayName}'s`} menu
            <span style={{ color: C.muted, font: `400 12px ${font.sans}`, marginLeft: 8 }}>· {dishes.length} dish{dishes.length === 1 ? '' : 'es'}</span>
          </div>
          {dishes.length === 0 ? (
            <div style={{ padding: 22, background: C.card, borderRadius: 14, textAlign: 'center', color: C.muted, font: `400 12.5px ${font.sans}` }}>
              No dishes on the menu right now. Check back later.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dishes.map(dish => (
                <Link
                  key={dish.id}
                  href={`/?dish=${dish.id}`}
                  style={{ background: C.card, borderRadius: 14, padding: 11, display: 'flex', gap: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)', textDecoration: 'none', color: 'inherit', position: 'relative' }}
                >
                  <div style={{ width: 84, height: 84, borderRadius: 11, overflow: 'hidden', flex: 'none' }}>
                    {dish.photo_url ? (
                      <div style={{ width: '100%', height: '100%', backgroundImage: `url(${dish.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#ece3d5,#ece3d5 9px,#f2ebde 9px,#f2ebde 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>{dish.emoji}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ font: `500 15px/1.15 ${font.serif}`, color: C.ink }}>{dish.name}</div>
                      <div style={{ font: `500 15px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(dish.price).toFixed(0)}</div>
                    </div>
                    {dish.description && (
                      <div style={{ font: `400 11.5px/1.4 ${font.sans}`, color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{dish.description}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                      {dish.review_count > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: `500 10.5px ${font.sans}`, color: C.ink }}>
                          <Star size={10} fill={C.gold} color={C.gold} /> {Number(dish.avg_rating || 0).toFixed(1)} <span style={{ color: C.muted, fontWeight: 400 }}>({dish.review_count})</span>
                        </span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: C.terracottaLight, color: C.terracotta, padding: '3px 8px', borderRadius: 7, font: `500 10.5px ${font.sans}` }}>
                        <Heart size={10} /> {dish.likes}
                      </span>
                    </div>
                  </div>
                  {dish.is_featured && (
                    <div style={{ position: 'absolute', top: 8, left: 8, background: C.gold, color: '#fff', padding: '2px 7px', borderRadius: 6, font: `500 9px ${font.sans}`, letterSpacing: '.03em' }}>FEATURED</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Catering menu — order ahead for a scheduled pickup date */}
        {cateringDishes.length > 0 && (
          <div style={{ padding: '26px 20px 0' }}>
            <div style={{ font: `500 16px ${font.serif}`, color: C.ink, marginBottom: 4 }}>
              Catering menu
              <span style={{ color: C.muted, font: `400 12px ${font.sans}`, marginLeft: 8 }}>· {cateringDishes.length} item{cateringDishes.length === 1 ? '' : 's'}</span>
            </div>
            <div style={{ font: `400 12px/1.4 ${font.sans}`, color: C.muted, marginBottom: 10 }}>
              Order ahead — you&apos;ll pick your pickup date at checkout.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cateringDishes.map(dish => (
                <Link
                  key={dish.id}
                  href={`/?dish=${dish.id}`}
                  style={{ background: C.card, borderRadius: 14, padding: 11, display: 'flex', gap: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)', textDecoration: 'none', color: 'inherit', position: 'relative' }}
                >
                  <div style={{ width: 84, height: 84, borderRadius: 11, overflow: 'hidden', flex: 'none' }}>
                    {dish.photo_url ? (
                      <div style={{ width: '100%', height: '100%', backgroundImage: `url(${dish.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#ece3d5,#ece3d5 9px,#f2ebde 9px,#f2ebde 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>{dish.emoji}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ font: `500 15px/1.15 ${font.serif}`, color: C.ink }}>{dish.name}</div>
                      <div style={{ font: `500 15px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(dish.price).toFixed(0)}</div>
                    </div>
                    {dish.description && (
                      <div style={{ font: `400 11.5px/1.4 ${font.sans}`, color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{dish.description}</div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                      {dish.review_count > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: `500 10.5px ${font.sans}`, color: C.ink }}>
                          <Star size={10} fill={C.gold} color={C.gold} /> {Number(dish.avg_rating || 0).toFixed(1)} <span style={{ color: C.muted, fontWeight: 400 }}>({dish.review_count})</span>
                        </span>
                      )}
                      <span style={{ background: C.greenLight, color: C.green, padding: '3px 8px', borderRadius: 7, font: `500 10.5px ${font.sans}` }}>Schedule ahead</span>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: 8, left: 8, background: C.green, color: '#fff', padding: '2px 7px', borderRadius: 6, font: `500 9px ${font.sans}`, letterSpacing: '.03em' }}>CATERING</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent posts */}
        {posts.length > 0 && (
          <div style={{ padding: '26px 20px 0' }}>
            <div style={{ font: `500 16px ${font.serif}`, color: C.ink, marginBottom: 10 }}>
              Recent posts
              <span style={{ color: C.muted, font: `400 12px ${font.sans}`, marginLeft: 8 }}>· active in the last 24hr</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {posts.map(p => (
                <div key={p.id} style={{ background: C.card, borderRadius: 14, padding: '12px 12px 10px', boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ font: `400 13.5px/1.4 ${font.sans}`, color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: p.photo_url ? 8 : 6 }}>
                    {p.body}
                  </div>
                  {p.photo_url && (
                    <img src={p.photo_url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, font: `400 10.5px ${font.sans}`, color: C.muted }}>
                    <span>{timeAgo(p.created_at)}</span>
                    {(p.heart_count + p.fire_count + p.hands_count) > 0 && (
                      <span>❤️ {p.heart_count + p.fire_count + p.hands_count}</span>
                    )}
                    {p.comment_count > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <MessageCircle size={11} /> {p.comment_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: '26px 20px 30px', textAlign: 'center' }}>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: C.terracotta, color: '#fff', borderRadius: 20, font: `500 13px ${font.sans}`, textDecoration: 'none' }}
          >
            <ChefHat size={14} /> Browse more cooks
          </Link>
        </div>
      </div>
    </div>
  );
}
