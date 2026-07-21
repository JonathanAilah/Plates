import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getUser, setStripeAccountId } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { userId } = await req.json(); // TODO: replace with your real auth-derived user id

  const user = await getUser(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let accountId = user.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
    });
    accountId = account.id;
    await setStripeAccountId(userId, accountId);
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/cook/onboarding/refresh`,
    return_url: `${baseUrl}/cook/onboarding/complete`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}