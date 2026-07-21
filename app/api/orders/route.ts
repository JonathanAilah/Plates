import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getOrders, updateOrderStatus, getSellerOrders } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const sellerId = searchParams.get('sellerId');

    if (action === 'getUser' && userId) {
      const orders = await getOrders(parseInt(userId));
      return NextResponse.json(orders);
    }

    if (action === 'getSeller' && sellerId) {
      const orders = await getSellerOrders(parseInt(sellerId));
      return NextResponse.json(orders);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, buyerId, dishId, quantity, totalPrice, orderId, status } = await request.json();

    if (action === 'create') {
      const order = await createOrder(buyerId, dishId, quantity, totalPrice);
      return NextResponse.json(order);
    }

    if (action === 'updateStatus') {
      // Whitelist valid statuses
      const valid = ['placed', 'accepted', 'cooking', 'ready', 'picked_up', 'cancelled'];
      if (!valid.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const order = await updateOrderStatus(orderId, status);
      return NextResponse.json(order);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
