import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { requireSessionUser } from '@/lib/auth';
import { getUser, getCookBalance, reserveWithdrawal, settleWithdrawal } from '@/lib/db';

// Withdraw Funds: moves the cook's full available Plates balance to their
// Stripe connected account. The amount is always computed server-side; the
// reservation insert is atomic against the ledger, so a double-tap (or two
// devices) can't withdraw the same dollars twice.
export const dynamic = 'force-dynamic';

const MIN_WITHDRAWAL = 1;  // dollars
const INSTANT_FEE = 1;     // dollars, kept by Plates for the instant option

export async function POST(req: Request) {
  try {
    const me = await requireSessionUser();
    const body = await req.json().catch(() => ({}));
    const instant = body?.instant === true;

    const user = await getUser(me.id);
    if (!user || user.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Only approved cooks can withdraw' }, { status: 403 });
    }
    if (!user.stripe_account_id) {
      return NextResponse.json({ error: 'Connect your bank first (Profile → Payments)' }, { status: 400 });
    }

    const balance = await getCookBalance(user.id);
    const minimum = instant ? MIN_WITHDRAWAL + INSTANT_FEE : MIN_WITHDRAWAL;
    if (balance.available < minimum) {
      return NextResponse.json({ error: `Minimum ${instant ? 'instant ' : ''}withdrawal is $${minimum.toFixed(2)} — you have $${balance.available.toFixed(2)} available` }, { status: 400 });
    }

    // The full available amount leaves the cook's Plates balance; for
    // instant withdrawals, Plates keeps $1 of it and sends the rest.
    const reservation = await reserveWithdrawal(user.id, balance.available);
    if (!reservation) {
      return NextResponse.json({ error: 'Your balance just changed — refresh and try again' }, { status: 409 });
    }

    const grossCents = Math.round(Number(reservation.amount) * 100);
    const feeCents = instant ? INSTANT_FEE * 100 : 0;
    const sendCents = grossCents - feeCents;

    try {
      const transfer = await stripe.transfers.create({
        amount: sendCents,
        currency: 'usd',
        destination: user.stripe_account_id,
        description: `Plates ${instant ? 'instant ' : ''}withdrawal #${reservation.id}`,
        metadata: { cookId: String(user.id), withdrawalId: String(reservation.id), method: instant ? 'instant' : 'standard' },
      });

      if (!instant) {
        const settled = await settleWithdrawal(reservation.id, 'paid', transfer.id, 'standard', 0);
        return NextResponse.json({ success: true, withdrawal: settled });
      }

      // Instant: push the money straight out of the connected account to the
      // cook's debit card / instant-eligible bank.
      try {
        await stripe.payouts.create(
          { amount: sendCents, currency: 'usd', method: 'instant' },
          { stripeAccount: user.stripe_account_id },
        );
        const settled = await settleWithdrawal(reservation.id, 'paid', transfer.id, 'instant', INSTANT_FEE);
        return NextResponse.json({ success: true, withdrawal: settled });
      } catch (payoutErr: any) {
        // The transfer already landed in their Stripe account, so the money
        // arrives on the normal schedule — refund the $1 fee since instant
        // didn't actually happen.
        console.warn('Instant payout unavailable, falling back to standard:', payoutErr?.message);
        let feeRefunded = false;
        try {
          await stripe.transfers.create({
            amount: feeCents,
            currency: 'usd',
            destination: user.stripe_account_id,
            description: `Plates withdrawal #${reservation.id} — instant fee refund`,
          });
          feeRefunded = true;
        } catch (refundErr) {
          console.error('Instant fee make-whole transfer failed:', refundErr);
        }
        const settled = await settleWithdrawal(
          reservation.id, 'paid', transfer.id, 'instant_fallback', feeRefunded ? 0 : INSTANT_FEE,
        );
        return NextResponse.json({
          success: true,
          withdrawal: settled,
          notice: feeRefunded
            ? "Instant isn't available for your bank — sent as a standard withdrawal instead, no fee charged."
            : "Instant isn't available for your bank — sent as a standard withdrawal. Contact support about the fee.",
        });
      }
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
