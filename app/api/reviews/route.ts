import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import {
  createReview, getReviewForOrder, getReviewsForDish, getUnreviewedOrdersForBuyer,
} from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'forDish') {
      const dishId = parseInt(searchParams.get('dishId') || '0');
      if (!dishId) return NextResponse.json({ error: 'dishId required' }, { status: 400 });
      const reviews = await getReviewsForDish(dishId);
      return NextResponse.json(reviews);
    }

    // These require auth
    const me = await requireSessionUser();

    if (action === 'unreviewedOrders') {
      const orders = await getUnreviewedOrdersForBuyer(me.id);
      return NextResponse.json(orders);
    }

    if (action === 'forOrder') {
      const orderId = searchParams.get('orderId');
      if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
      const review = await getReviewForOrder(orderId);
      return NextResponse.json(review);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Reviews GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const { action, orderId, rating, comment } = body;

    if (action === 'create') {
      if (!orderId || !rating) return NextResponse.json({ error: 'orderId and rating required' }, { status: 400 });
      const r = Number(rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 });
      }

      // Verify: (a) this order exists, (b) the buyer is the requester, (c) it's picked_up
      const check = await sql`
        SELECT o.id, o.buyer_id, o.dish_id, o.status
        FROM orders o WHERE o.id = ${orderId} LIMIT 1
      `;
      const row = check.rows[0];
      if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (row.buyer_id !== me.id) return NextResponse.json({ error: 'Not your order' }, { status: 403 });
      if (row.status !== 'picked_up') {
        return NextResponse.json({ error: 'Can only rate orders that have been picked up' }, { status: 400 });
      }

      // Duplicate prevention (also enforced by UNIQUE constraint at DB level)
      const existing = await getReviewForOrder(orderId);
      if (existing) return NextResponse.json({ error: 'You already rated this order' }, { status: 400 });

      const review = await createReview(orderId, row.dish_id, me.id, r, comment ?? null);
      return NextResponse.json(review);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Reviews POST error:', error);
    // Catch race-condition duplicate insert (UNIQUE constraint)
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'You already rated this order' }, { status: 400 });
    }
    return errorResponse(error);
  }
}
