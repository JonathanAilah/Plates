import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createOrder, getOrders, updateOrderStatus, getSellerOrders } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'getUser') {
      const orders = await getOrders(me.id);
      return NextResponse.json(orders);
    }

    if (action === 'getSeller') {
      const orders = await getSellerOrders(me.id);
      return NextResponse.json(orders);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Orders GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const { action, orderId, status, pickupCode } = body;

    if (action === 'create') {
      const order = await createOrder(me.id, body.dishId, body.quantity, body.totalPrice);
      return NextResponse.json(order);
    }

    if (action === 'updateStatus') {
      const valid = ['placed', 'accepted', 'cooking', 'ready', 'picked_up', 'cancelled'];
      if (!valid.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      if (status === 'picked_up') {
        return NextResponse.json({ error: 'Use confirmPickup with a code to mark picked up' }, { status: 400 });
      }
      // Verify the requester is either the buyer (for cancel) or the seller (for other transitions)
      const check = await sql`
        SELECT o.buyer_id, d.seller_id FROM orders o
        JOIN dishes d ON o.dish_id = d.id
        WHERE o.id = ${orderId} LIMIT 1
      `;
      const row = check.rows[0];
      if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      const isBuyer = row.buyer_id === me.id;
      const isSeller = row.seller_id === me.id;
      if (!isBuyer && !isSeller) return NextResponse.json({ error: 'Not your order' }, { status: 403 });
      // Buyers can only cancel; sellers drive other transitions
      if (isBuyer && !isSeller && status !== 'cancelled') {
        return NextResponse.json({ error: 'Only the cook can advance status' }, { status: 403 });
      }
      const order = await updateOrderStatus(orderId, status);
      return NextResponse.json(order);
    }

    if (action === 'confirmPickup') {
      if (!orderId || !pickupCode) {
        return NextResponse.json({ error: 'orderId and pickupCode required' }, { status: 400 });
      }
      const check = await sql`
        SELECT o.id, o.status, o.pickup_code, d.seller_id
        FROM orders o JOIN dishes d ON o.dish_id = d.id
        WHERE o.id = ${orderId} LIMIT 1
      `;
      const row = check.rows[0];
      if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (row.seller_id !== me.id) return NextResponse.json({ error: 'Not your order' }, { status: 403 });
      if (row.status !== 'ready') {
        return NextResponse.json({ error: `Order is ${row.status}, not ready for pickup` }, { status: 400 });
      }
      if (String(row.pickup_code).trim() !== String(pickupCode).trim()) {
        return NextResponse.json({ error: 'Wrong code', codeMismatch: true }, { status: 400 });
      }
      const order = await updateOrderStatus(orderId, 'picked_up');
      return NextResponse.json({ order, verified: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Orders POST error:', error);
    return errorResponse(error);
  }
}
