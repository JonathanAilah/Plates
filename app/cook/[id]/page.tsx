import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCookPublicProfile } from '@/lib/db';
import CookProfileView from './CookProfileView';

// Server-rendered public cook profile page.
// Accessible to anyone — no auth required. Renders 404 for non-approved cooks.

export const dynamic = 'force-dynamic'; // always fresh data

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const userId = parseInt(params.id);
  if (!userId || isNaN(userId)) return { title: 'Cook not found · Plates' };
  const profile = await getCookPublicProfile(userId).catch(() => null);
  if (!profile) return { title: 'Cook not found · Plates' };
  const name = profile.cook.kitchen_name || profile.cook.name;
  const title = `${name} · Plates`;
  const description = profile.cook.bio || `Home-cooked meals from ${name}. Order on Plates and pick up nearby.`;
  // Best available image for the social card: the cook's photo, else their
  // first dish photo.
  const photo = profile.cook.photo_url
    || profile.dishes.find((d: any) => d.photo_url)?.photo_url
    || null;
  const images = photo && String(photo).startsWith('http') ? [photo] : [];
  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: { title, description, type: 'profile', url: `${baseUrl}/cook/${userId}`, images, siteName: 'Plates' },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description, images },
  };
}

export default async function CookProfilePage({ params }: { params: { id: string } }) {
  const userId = parseInt(params.id);
  if (!userId || isNaN(userId)) notFound();

  const profile = await getCookPublicProfile(userId).catch(() => null);
  if (!profile) notFound();

  return <CookProfileView profile={profile as any} />;
}
