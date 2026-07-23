import { NextRequest, NextResponse } from 'next/server';
import {
  getUnreadCounts, getOrdersVersion, getMessagesVersion,
  getPendingSellersCount, getOrderIfParticipant,
} from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Auth reads request headers, so this route can never be statically rendered.
export const dynamic = 'force-dynamic';

// One cheap poll for everything the client used to check on separate timers:
// unread message counts, an orders change-detector, the admin pending count,
// and (when a chat is open) a messages change-detector for that order.
// The client only refetches full data when a version string changes.
export async function GET(request: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const chatOrderId = searchParams.get('chatOrderId');

    const [unread, ordersVersion, adminPending, chatVersion] = await Promise.all([
      getUnreadCounts(me.id),
      getOrdersVersion(me.id),
      me.role === 'admin' ? getPendingSellersCount() : Promise.resolve(null),
      chatOrderId
        ? getOrderIfParticipant(chatOrderId, me.id).then(order =>
            order ? getMessagesVersion(chatOrderId) : null)
        : Promise.resolve(null),
    ]);

    return NextResponse.json({ unread, ordersVersion, adminPending, chatVersion });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
