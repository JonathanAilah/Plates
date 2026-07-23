import { notFound } from 'next/navigation';
import { getDishPublic } from '@/lib/db';
import MealShareView from './MealShareView';

// Server-rendered public dish page — the shareable link for social media.
// generateMetadata provides the Open Graph card (photo, name, price, cook)
// that iMessage/WhatsApp/Instagram/X render when the link is shared.

export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const dishId = parseInt(params.id);
  if (!dishId || isNaN(dishId)) return { title: 'Dish not found · Plates' };
  const dish = await getDishPublic(dishId).catch(() => null);
  if (!dish) return { title: 'Dish not found · Plates' };

  const cookName = dish.seller_kitchen_name || dish.seller_name;
  const title = `${dish.name} · $${Number(dish.price).toFixed(0)} on Plates`;
  const description = dish.description
    ? String(dish.description).slice(0, 160)
    : `Homemade ${dish.name} from ${cookName}. Order on Plates and pick it up nearby.`;
  const image = dish.photo_url && String(dish.photo_url).startsWith('http') ? [dish.photo_url] : [];

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/meal/${dish.id}`,
      images: image,
      siteName: 'Plates',
    },
    twitter: {
      card: image.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image,
    },
  };
}

export default async function MealPage({ params }: { params: { id: string } }) {
  const dishId = parseInt(params.id);
  if (!dishId || isNaN(dishId)) notFound();

  const dish = await getDishPublic(dishId).catch(() => null);
  if (!dish) notFound();

  return <MealShareView dish={dish as any} />;
}
