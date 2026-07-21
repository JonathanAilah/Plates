import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCookPublicProfile } from '@/lib/db';
import CookProfileView from './CookProfileView';

// Server-rendered public cook profile page.
// Accessible to anyone — no auth required. Renders 404 for non-approved cooks.

export const dynamic = 'force-dynamic'; // always fresh data

export async function generateMetadata({ params }: { params: { id: string } }) {
  const userId = parseInt(params.id);
  if (!userId || isNaN(userId)) return { title: 'Cook not found · Plates' };
  const profile = await getCookPublicProfile(userId).catch(() => null);
  if (!profile) return { title: 'Cook not found · Plates' };
  const name = profile.cook.kitchen_name || profile.cook.name;
  return {
    title: `${name} · Plates`,
    description: profile.cook.bio || `Home-cooked meals from ${name}.`,
  };
}

export default async function CookProfilePage({ params }: { params: { id: string } }) {
  const userId = parseInt(params.id);
  if (!userId || isNaN(userId)) notFound();

  const profile = await getCookPublicProfile(userId).catch(() => null);
  if (!profile) notFound();

  return <CookProfileView profile={profile as any} />;
}
