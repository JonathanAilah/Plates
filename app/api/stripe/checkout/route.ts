import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLATES_FEE_PERCENT } from '@/lib/stripe';
import { getCartGroupedBySeller, getUser } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await req.json();
    const tipCents = Math.round((Number(body.tipAmount) || 0) * 100);
    const feeCents = Math.round((Number(body.serviceFee) || 0) * 100);

    const grouped = await getCartGroupedBySeller(me.id);
    if (grouped.size === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const intents: { sellerId: number; clientSecret: string; amount: number; paymentIntentId: string }[] = [];
    let first = true;

    for (const [sellerId, items] of grouped) {
      const seller = await getUser(sellerId);
      if (!seller?.stripe_account_id || !seller.stripe_charges_enabled) {
        return NextResponse.json(
          { error: `A cook in your cart isn't set up to receive payments yet.` },
          { status: 400 },
        );
      }

      const subtotalCents = items.reduce(
        (sum: number, i: any) => sum + Math.round(Number(i.price) * 100) * i.quantity,
        0,
      );
      // Tip + service fee ride on the first cook's charge (single-cook default).
      const extrasCents = first ? tipCents + feeCents : 0;
      const amountCents = subtotalCents + extrasCents;
      const applicationFee = Math.round(subtotalCents * PLATES_FEE_PERCENT) + (first ? feeCents : 0);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        application_fee_amount: applicationFee,
        transfer_data: { destination: seller.stripe_account_id },
        metadata: { buyerId: String(me.id), sellerId: String(sellerId) },
      });

      intents.push({ sellerId, clientSecret: paymentIntent.client_secret!, amount: amountCents, paymentIntentId: paymentIntent.id });
      first = false;
    }

    return NextResponse.json({ intents });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: error?.message || 'Checkout failed' }, { status: error?.status || 500 });
  }
}