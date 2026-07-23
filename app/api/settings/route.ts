import { NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/db';

// Public read of the platform pricing settings (tax, service fee, default
// tip) so the cart can show accurate numbers. Values are non-sensitive.
// Editing happens through /api/admin (admin-only).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
