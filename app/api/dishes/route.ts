import { NextRequest, NextResponse } from 'next/server';
import { createDish, getDishes, getDish, getSellerDishes, toggleLike, isLiked } from '@/lib/db';

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
      const result = await toggleLike(userId, dishId);
      const liked = await isLiked(userId, dishId);
      return NextResponse.json({ liked });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Dishes POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
