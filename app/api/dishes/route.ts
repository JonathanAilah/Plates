import { NextRequest, NextResponse } from 'next/server';
import {
  createDish, getDishes, getDish, getSellerDishes, toggleLike, isLiked,
  updateDishPrice, deleteDish, updateDishPhoto, checkGenRateLimit,
} from '@/lib/db';
import { generateFoodImage } from '@/lib/imageGen';
import { getSessionUser, requireSessionUser } from '@/lib/auth';

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

    // Public: anyone can browse
    if (action === 'getAll') {
      const dishes = await getDishes();
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
      // Server enforces seller_id is the current user — client can't spoof
      const dish = await createDish(me.id, body.name, body.description, body.price, body.emoji, body.photoUrl ?? null);
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
        const updated = await updateDishPhoto(dish.id, result.dataUrl);
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
