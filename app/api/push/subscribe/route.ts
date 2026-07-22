import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription, deletePushSubscription } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, subscription } = body;

    if (action === 'subscribe') {
      if (!userId || !subscription?.endpoint || !subscription?.keys) {
        return NextResponse.json({ error: 'Missing subscription data' }, { status: 400 });
      }
      const saved = await savePushSubscription(
        userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth
      );
      return NextResponse.json(saved);
    }

    if (action === 'unsubscribe') {
      if (!subscription?.endpoint) {
        return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
      }
      await deletePushSubscription(subscription.endpoint);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}