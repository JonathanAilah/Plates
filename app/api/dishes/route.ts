import { NextRequest, NextResponse } from 'next/server';
import {
  createDish, getDishes, getDish, getSellerDishes, toggleLike, isLiked,
  updateDishPrice, deleteDish, updateDishPhoto, checkGenRateLimit,
  updateDishFeatured, updateDishHidden, initializeDatabase,
} from '@/lib/db';
import { generateFoodImage } from '@/lib/imageGen';
import { getSessionUser, requireSessionUser } from '@/lib/auth';
import { FOOD_TAGS, MAX_DISH_TAGS } from '@/lib/tags';

export const maxDuration = 60;

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const sellerId = searchParams.get('sellerId');

    // Public: anyone can browse. Ensure the schema is migrated on the first
    // request after a cold start (memoized — a no-op once the instance is warm).
    if (action === 'getAll') {
      await initializeDatabase();
      const num = (v: string | null): number | null => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const dishes = await getDishes({
        lat: num(searchParams.get('lat')),
        lng: num(searchParams.get('lng')),
        radiusMiles: num(searchParams.get('radiusMi')),
        search: searchParams.get('search'),
        limit: num(searchParams.get('limit')),
        offset: num(searchParams.get('offset')) ?? 0,
      });
      return NextResponse.json(dishes);
    }

    if (action === 'getOne' && id) {
      const dish = await getDish(parseInt(id));
      return NextResponse.json(dish);
    }

    if (action === 'getSeller' && sellerId) {
      const dishes = await getSellerDishes(parseInt(sellerId));
      return NextResponse.json(dishes);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Dishes GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // All POSTs require auth
    const me = await requireSessionUser();

    if (action === 'create') {
      // Only approved sellers can post dishes
      if (me.seller_status !== 'approved' || !me.is_seller) {
        return NextResponse.json({ error: 'Seller mode must be on to post dishes' }, { status: 403 });
      }
      if (me.account_disabled) {
        return NextResponse.json({ error: 'Account is disabled' }, { status: 403 });
      }
      // Optional extras: side options ([{ name, price }] — the price is
      // added to the meal total when the buyer picks that side) and a daily
      // selling window (HH:MM). Validate shape server-side; the client also
      // checks the window against the cook's stated cooking hours.
      let sides: string | null = null;
      if (Array.isArray(body.sides)) {
        const cleaned = body.sides
          .map((s: any) => ({
            name: String(s?.name ?? '').trim().slice(0, 80),
            price: Math.min(1000, Math.max(0, Math.round((Number(s?.price) || 0) * 100) / 100)),
          }))
          .filter((s: { name: string }) => s.name)
          .slice(0, 12);
        sides = cleaned.length ? JSON.stringify(cleaned) : null;
      } else if (typeof body.sides === 'string' && body.sides.trim()) {
        // Legacy comma-separated names (no prices)
        sides = body.sides.split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 12).join(', ').slice(0, 500) || null;
      }
      // Food-type tags: whitelist against the shared list, cap the count
      const tags = Array.isArray(body.tags)
        ? body.tags.filter((t: any) => FOOD_TAGS.includes(t)).slice(0, MAX_DISH_TAGS).join(',') || null
        : null;
      const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;
      const sellStart = typeof body.sellStart === 'string' && timeRe.test(body.sellStart) ? body.sellStart : null;
      const sellEnd = typeof body.sellEnd === 'string' && timeRe.test(body.sellEnd) ? body.sellEnd : null;
      if ((sellStart && !sellEnd) || (!sellStart && sellEnd)) {
        return NextResponse.json({ error: 'Set both a start and end time for the selling window' }, { status: 400 });
      }
      if (sellStart && sellEnd && sellStart >= sellEnd) {
        return NextResponse.json({ error: 'Selling window must start before it ends' }, { status: 400 });
      }
      const dish = await createDish(me.id, body.name, body.description, body.price, body.emoji, body.photoUrl ?? null, body.isCatering === true, sides, sellStart, sellEnd, tags);
      return NextResponse.json(dish);
    }

    if (action === 'toggleLike') {
      await toggleLike(me.id, body.dishId);
      const liked = await isLiked(me.id, body.dishId);
      return NextResponse.json({ liked });
    }

    if (action === 'updatePrice') {
      // Verify ownership
      const dish = await getDish(body.dishId);
      if (!dish) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (dish.seller_id !== me.id) return NextResponse.json({ error: 'Not your dish' }, { status: 403 });
      const updated = await updateDishPrice(body.dishId, body.price);
      return NextResponse.json(updated);
    }

    if (action === 'setFeatured') {
      const dish = await getDish(body.dishId);
      if (!dish) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (dish.seller_id !== me.id) return NextResponse.json({ error: 'Not your dish' }, { status: 403 });
      const updated = await updateDishFeatured(body.dishId, !!body.featured);
      return NextResponse.json(updated);
    }

    if (action === 'setHidden') {
      const dish = await getDish(body.dishId);
      if (!dish) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (dish.seller_id !== me.id) return NextResponse.json({ error: 'Not your dish' }, { status: 403 });
      const updated = await updateDishHidden(body.dishId, !!body.hidden);
      return NextResponse.json(updated);
    }

    if (action === 'delete') {
      const dish = await getDish(body.dishId);
      if (!dish) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      if (dish.seller_id !== me.id) return NextResponse.json({ error: 'Not your dish' }, { status: 403 });
      const result = await deleteDish(body.dishId);
      return NextResponse.json(result);
    }

    if (action === 'generatePhoto') {
      const dish = await getDish(body.dishId);
      if (!dish) return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
      if (dish.seller_id !== me.id) return NextResponse.json({ error: 'Not your dish' }, { status: 403 });
      if (dish.photo_url) return NextResponse.json({ error: 'Dish already has a photo' }, { status: 400 });

      const rl = checkGenRateLimit(me.id);
      if (!rl.allowed) {
        return NextResponse.json({ error: `Please wait ${Math.ceil(rl.retryInMs / 1000)}s`, retryInMs: rl.retryInMs }, { status: 429 });
      }

      try {
        const result = await generateFoodImage(dish.name);
        const updated = await updateDishPhoto(dish.id, result.url);
        return NextResponse.json(updated);
      } catch (err) {
        console.error('Image generation failed:', err);
        return NextResponse.json({ error: 'Image generation failed. Try again in a moment.' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Dishes POST error:', error);
    return errorResponse(error);
  }
}
