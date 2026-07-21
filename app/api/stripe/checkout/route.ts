import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLATES_FEE_PERCENT } from '@/lib/stripe';
import { getCartGroupedBySeller, getUser } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { buyerId } = await req.json(); // TODO: replace with real auth

  const grouped = await getCartGroupedBySeller(buyerId);
  if (grouped.size === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const intents: { sellerId: number; clientSecret: string; amount: number }[] = [];

  for (const [sellerId, items] of grouped) {
    const seller = await getUser(sellerId);
    if (!seller?.stripe_account_id || !seller.stripe_charges_enabled) {
      return NextResponse.json(
        { error: `Seller ${sellerId} isn't set up to receive payments yet` },
        { status: 400 },
      );
    }

    const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
    const amountCents = Math.round(subtotal * 100);
    const applicationFee = Math.round(amountCents * PLATES_FEE_PERCENT);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      application_fee_amount: applicationFee,
      transfer_data: { destination: seller.stripe_account_id },
      metadata: { buyerId: String(buyerId), sellerId: String(sellerId) },
    });

    intents.push({ sellerId, clientSecret: paymentIntent.client_secret!, amount: amountCents });
  }

  return NextResponse.json({ intents });
}