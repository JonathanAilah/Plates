import { NextRequest, NextResponse } from 'next/server';
import {
  createDish, getDishes, getDish, getSellerDishes, toggleLike, isLiked,
  updateDishPrice, deleteDish, updateDishPhoto, checkGenRateLimit,
} from '@/lib/db';
import { generateFoodImage } from '@/lib/imageGen';

// Image generation may take up to ~30 seconds
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const sellerId = searchParams.get('sellerId');

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, sellerId, name, description, price, emoji, userId, dishId, photoUrl } = await request.json();

    if (action === 'create') {
      const dish = await createDish(sellerId, name, description, price, emoji, photoUrl ?? null);
      return NextResponse.json(dish);
    }

    if (action === 'toggleLike') {
      await toggleLike(userId, dishId);
      const liked = await isLiked(userId, dishId);
      return NextResponse.json({ liked });
    }

    if (action === 'updatePrice') {
      const dish = await updateDishPrice(dishId, price);
      return NextResponse.json(dish);
    }

    if (action === 'delete') {
      const result = await deleteDish(dishId);
      return NextResponse.json(result);
    }

    if (action === 'generatePhoto') {
      // Requires userId (the requesting cook) and dishId
      if (!userId || !dishId) {
        return NextResponse.json({ error: 'userId and dishId required' }, { status: 400 });
      }

      // Load the dish and verify ownership + no existing photo
      const dish = await getDish(parseInt(dishId));
      if (!dish) return NextResponse.json({ error: 'Dish not found' }, { status: 404 });
      if (dish.seller_id !== parseInt(userId)) {
        return NextResponse.json({ error: 'Not your dish' }, { status: 403 });
      }
      if (dish.photo_url) {
        return NextResponse.json({ error: 'Dish already has a photo' }, { status: 400 });
      }

      // Rate limit
      const rl = checkGenRateLimit(parseInt(userId));
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
