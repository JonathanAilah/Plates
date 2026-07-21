import { NextRequest, NextResponse } from 'next/server';
import {
  getOrderIfParticipant,
  getMessagesForOrder,
  sendMessage,
  markMessagesRead,
  getUnreadCounts,
} from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const orderId = searchParams.get('orderId');
    const userId = searchParams.get('userId');

    if (action === 'unreadCounts' && userId) {
      const counts = await getUnreadCounts(parseInt(userId));
      return NextResponse.json(counts);
    }

    if (action === 'list' && orderId && userId) {
      // Authorize
      const order = await getOrderIfParticipant(orderId, parseInt(userId));
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      const messages = await getMessagesForOrder(orderId);
      return NextResponse.json(messages);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Messages GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId, senderId, message, userId } = body;

    if (action === 'send') {
      // Authorize
      const order = await getOrderIfParticipant(orderId, senderId);
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      // Block sending on closed orders
      if (order.status === 'picked_up' || order.status === 'cancelled') {
        return NextResponse.json({ error: 'This order is closed' }, { status: 400 });
      }
      const sent = await sendMessage(orderId, senderId, message);
      return NextResponse.json(sent);
    }

    if (action === 'markRead') {
      const readerId = userId || senderId;
      const order = await getOrderIfParticipant(orderId, readerId);
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      const result = await markMessagesRead(orderId, readerId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Messages POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
