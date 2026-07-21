import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { updateStripeAccountStatus, getOrderByPaymentIntent, updateOrderStatus } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as any;
      await updateStripeAccountStatus(account.id, account.charges_enabled, account.payouts_enabled);
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as any;
      const order = await getOrderByPaymentIntent(pi.id);
      if (order) await updateOrderStatus(order.id, 'placed');
      break;
    }
  }

  return NextResponse.json({ received: true });
}