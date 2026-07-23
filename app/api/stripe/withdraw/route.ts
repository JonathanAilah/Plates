import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/auth';
import { getUser, getCookBalance, reserveWithdrawal, settleWithdrawal } from '@/lib/db';

// Withdraw Funds: moves the cook's full available Plates balance to their
// Stripe connected account. The amount is always computed server-side; the
// reservation insert is atomic against the ledger, so a double-tap (or two
// devices) can't withdraw the same dollars twice.
export const dynamic = 'force-dynamic';

const MIN_WITHDRAWAL = 1; // dollars

export async function POST() {
  try {
    const me = await requireSessionUser();
    const user = await getUser(me.id);
    if (!user || user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Only approved cooks can withdraw' }, { status: 403 });
    }
    if (!user.stripe_account_id) {
      return NextResponse.json({ error: 'Connect your bank first (Profile → Payments)' }, { status: 400 });
    }

    const balance = await getCookBalance(user.id);
    if (balance.available < MIN_WITHDRAWAL) {
      return NextResponse.json({ error: `Minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(2)} — you have $${balance.available.toFixed(2)} available` }, { status: 400 });
    }

    const reservation = await reserveWithdrawal(user.id, balance.available);
    if (!reservation) {
      return NextResponse.json({ error: 'Your balance just changed — refresh and try again' }, { status: 409 });
    }

    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(Number(reservation.amount) * 100),
        currency: 'usd',
        destination: user.stripe_account_id,
        description: `Plates withdrawal #${reservation.id}`,
        metadata: { cookId: String(user.id), withdrawalId: String(reservation.id) },
      });
      const settled = await settleWithdrawal(reservation.id, 'paid', transfer.id);
      return NextResponse.json({ success: true, withdrawal: settled });
    } catch (stripeErr: any) {
      // Release the reserved dollars so the cook can retry
      await settleWithdrawal(reservation.id, 'failed', null);
      console.error('Withdrawal transfer failed:', stripeErr);
      return NextResponse.json(
        { error: stripeErr?.message || 'Transfer failed — your balance was not deducted' },
        { status: 502 },
      );
    }
  } catch (error: any) {
    console.error('Withdraw route error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: error?.status || 500 });
  }
}
