import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getUser, setStripeAccountId } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

// Stripe Connect for cooks. Two intents:
// - 'onboard' (default): create the Express account if needed and return an
//   onboarding link (also works to resume incomplete onboarding).
// - 'manage': return an Express-dashboard login link so an already-connected
//   cook can update bank/payout details.
// The acting user always comes from the session — never from the request
// body — so nobody can request links for someone else's account.
export async function POST(req: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await req.json().catch(() => ({}));
    const intent = body?.intent === 'manage' ? 'manage' : 'onboard';

    const user = await getUser(me.id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Only approved cooks can set up payouts' }, { status: 403 });
    }

    let accountId = user.stripe_account_id;

    if (intent === 'manage') {
      if (!accountId) {
        return NextResponse.json({ error: 'No payment account yet — connect your bank first' }, { status: 400 });
      }
      const login = await stripe.accounts.createLoginLink(accountId);
      return NextResponse.json({ url: login.url });
    }

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
      await setStripeAccountId(user.id, accountId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/cook/onboarding/refresh`,
      return_url: `${baseUrl}/cook/onboarding/complete`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Stripe connect error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: error?.status || 500 });
  }
}
