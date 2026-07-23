import { NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/db';

// Public read of the platform pricing settings (tax, service fee, default
// tip) so the cart can show accurate numbers. Values are non-sensitive.
// Editing happens through /api/admin (admin-only).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    // Explicit no-store: pricing can change from the admin panel at any time,
    // and this response must never be served stale from an intermediate
    // cache (browser, CDN) to a tab that's been open a while.
    return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
