import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
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
    const { action, buyerId, dishId, quantity, totalPrice, orderId, status, sellerId, pickupCode } = await request.json();

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
      // Block 'picked_up' via this action — must go through confirmPickup with code
      if (status === 'picked_up') {
        return NextResponse.json({ error: 'Use confirmPickup with a code to mark picked up' }, { status: 400 });
      }
      const order = await updateOrderStatus(orderId, status);
      return NextResponse.json(order);
    }

    if (action === 'confirmPickup') {
      if (!orderId || !sellerId || !pickupCode) {
        return NextResponse.json({ error: 'orderId, sellerId, and pickupCode required' }, { status: 400 });
      }

      // Look up the order and its seller in one query
      const check = await sql`
        SELECT o.id, o.status, o.pickup_code, d.seller_id
        FROM orders o
        JOIN dishes d ON o.dish_id = d.id
        WHERE o.id = ${orderId}
        LIMIT 1
      `;
      const row = check.rows[0];
      if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (row.seller_id !== parseInt(sellerId)) {
        return NextResponse.json({ error: 'Not your order' }, { status: 403 });
      }
      if (row.status !== 'ready') {
        return NextResponse.json({ error: `Order is ${row.status}, not ready for pickup` }, { status: 400 });
      }
      // Constant-time-ish comparison (values are 4 digits so timing attacks aren't a real threat here anyway)
      if (String(row.pickup_code).trim() !== String(pickupCode).trim()) {
        return NextResponse.json({ error: 'Wrong code', codeMismatch: true }, { status: 400 });
      }

      const order = await updateOrderStatus(orderId, 'picked_up');
      return NextResponse.json({ order, verified: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Orders POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
