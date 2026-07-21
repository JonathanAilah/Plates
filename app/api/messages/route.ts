import { NextRequest, NextResponse } from 'next/server';
import {
  getOrderIfParticipant, getMessagesForOrder, sendMessage,
  markMessagesRead, getUnreadCounts,
} from '@/lib/db';
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
    const orderId = searchParams.get('orderId');

    if (action === 'unreadCounts') {
      const counts = await getUnreadCounts(me.id);
      return NextResponse.json(counts);
    }

    if (action === 'list' && orderId) {
      const order = await getOrderIfParticipant(orderId, me.id);
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      const messages = await getMessagesForOrder(orderId);
      return NextResponse.json(messages);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Messages GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const { action, orderId, message } = body;

    if (action === 'send') {
      const order = await getOrderIfParticipant(orderId, me.id);
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      if (order.status === 'picked_up' || order.status === 'cancelled') {
        return NextResponse.json({ error: 'This order is closed' }, { status: 400 });
      }
      const sent = await sendMessage(orderId, me.id, message);
      return NextResponse.json(sent);
    }

    if (action === 'markRead') {
      const order = await getOrderIfParticipant(orderId, me.id);
      if (!order) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
      const result = await markMessagesRead(orderId, me.id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Messages POST error:', error);
    return errorResponse(error);
  }
}
