import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLATES_FEE_PERCENT } from '@/lib/stripe';
import { getCartGroupedBySeller, getUser, getPlatformSettings } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await req.json();
    // Tip is the buyer's choice — clamp to a sane range. Service fee and tax
    // are computed server-side from admin settings; the client's numbers are
    // display-only and never trusted for charging.
    const tipCents = Math.min(50000, Math.max(0, Math.round((Number(body.tipAmount) || 0) * 100)));

    const grouped = await getCartGroupedBySeller(me.id);
    if (grouped.size === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const settings = await getPlatformSettings();
    const cartSubtotalCents = Array.from(grouped.values()).reduce(
      (sum: number, items: any[]) =>
        sum + items.reduce((s: number, i: any) => s + Math.round(Number(i.price) * 100) * i.quantity, 0),
      0,
    );
    const feeCents = Math.max(
      Math.round(settings.serviceFeeMin * 100),
      Math.round(cartSubtotalCents * settings.serviceFeePercent / 100),
    );
    const taxCents = Math.round(cartSubtotalCents * settings.taxPercent / 100);

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
      // Tip + service fee + tax ride on the first cook's charge (single-cook
      // default). The tip passes through to the cook; the service fee and tax
      // are collected by the platform via the application fee (the platform
      // is the marketplace facilitator responsible for remitting tax).
      const extrasCents = first ? tipCents + feeCents + taxCents : 0;
      const amountCents = subtotalCents + extrasCents;
      const applicationFee = Math.round(subtotalCents * PLATES_FEE_PERCENT) + (first ? feeCents + taxCents : 0);

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