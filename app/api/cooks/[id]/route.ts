import { NextRequest, NextResponse } from 'next/server';
import { getCookPublicProfile } from '@/lib/db';

// Public endpoint — no auth required. Anonymous users can view cook profiles.
// Only returns data for approved, non-disabled cooks. Others 404.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid cook id' }, { status: 400 });
    }
    const profile = await getCookPublicProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Cook not found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('Cook profile GET error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
