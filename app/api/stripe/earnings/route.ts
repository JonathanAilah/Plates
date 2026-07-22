import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/auth';
import { getUser, getCookEarnings } from '@/lib/db';

export async function GET() {
  try {
    const me = await requireSessionUser();
    const user = await getUser(me.id);
    if (user?.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Not an approved seller' }, { status: 403 });
    }

    const earnings = await getCookEarnings(me.id);

    let stripeData: any = { available: 0, pending: 0, payouts: [] };
    if (user.stripe_account_id) {
      try {
        const balance = await stripe.balance.retrieve({}, { stripeAccount: user.stripe_account_id });
        const available = balance.available.reduce((s, b) => s + b.amount, 0) / 100;
        const pending = balance.pending.reduce((s, b) => s + b.amount, 0) / 100;
        const payouts = await stripe.payouts.list({ limit: 10 }, { stripeAccount: user.stripe_account_id });
        stripeData = {
          available,
          pending,
          payouts: payouts.data.map(p => ({
            id: p.id,
            amount: p.amount / 100,
            status: p.status,
            arrivalDate: p.arrival_date,
            created: p.created,
          })),
        };
      } catch (e) {
        console.error('Stripe balance/payout fetch failed:', e);
      }
    }

    return NextResponse.json({ earnings, stripe: stripeData });
  } catch (error: any) {
    console.error('Earnings route error:', error);
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: error?.status || 500 });
  }
}