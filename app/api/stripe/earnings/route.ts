import { NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/auth';
import { getUser, getCookEarnings, getCookBalance, getCookWithdrawals } from '@/lib/db';

// Cook earnings + their Plates balance. Under the escrow model the platform
// holds buyer payments; the numbers here come from Plates' own ledger
// (orders + withdrawals), not the cook's Stripe connected-account balance.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const me = await requireSessionUser();
    const user = await getUser(me.id);
    if (user?.seller_status !== 'approved') {
      return NextResponse.json({ error: 'Not an approved seller' }, { status: 403 });
    }

    const [earnings, balance, withdrawals] = await Promise.all([
      getCookEarnings(me.id),
      getCookBalance(me.id),
      getCookWithdrawals(me.id, 10),
    ]);

    return NextResponse.json({ earnings, balance, withdrawals });
  } catch (error: any) {
    console.error('Earnings route error:', error);
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: error?.status || 500 });
  }
}
