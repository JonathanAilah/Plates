import { NextRequest, NextResponse } from 'next/server';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart, checkoutCart } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const me = await requireSessionUser();
    const items = await getCart(me.id);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Cart GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const item = await addToCart(me.id, body.dishId, body.quantity || 1);
      return NextResponse.json(item);
    }

    if (action === 'update') {
      const result = await updateCartItem(body.cartItemId, body.quantity);
      return NextResponse.json(result);
    }

    if (action === 'remove') {
      const result = await removeCartItem(body.cartItemId);
      return NextResponse.json(result);
    }

    if (action === 'clear') {
      const result = await clearCart(me.id);
      return NextResponse.json(result);
    }

    if (action === 'checkout') {
      const result = await checkoutCart(me.id, body.tipAmount || 0, body.serviceFee || 0);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Cart POST error:', error);
    return errorResponse(error);
  }
}
