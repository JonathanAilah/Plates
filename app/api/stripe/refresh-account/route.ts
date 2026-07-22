import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireSessionUser, } from '@/lib/auth';
import { updateStripeAccountStatus, getUser } from '@/lib/db';

// Called from the onboarding-complete page to sync the cook's Stripe status
// directly from Stripe (instead of waiting on a webhook).
export async function POST(req: NextRequest) {
  try {
    const me = await requireSessionUser();
    const user = await getUser(me.id);
    if (!user?.stripe_account_id) {
      return NextResponse.json({ error: 'No Stripe account' }, { status: 400 });
    }

    const account = await stripe.accounts.retrieve(user.stripe_account_id);
    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;

    await updateStripeAccountStatus(user.stripe_account_id, chargesEnabled, payoutsEnabled);

    return NextResponse.json({ chargesEnabled, payoutsEnabled });
  } catch (error: any) {
    console.error('Refresh account error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to refresh' }, { status: error?.status || 500 });
  }
}
