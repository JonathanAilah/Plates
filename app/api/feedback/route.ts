import { NextRequest, NextResponse } from 'next/server';
import { createBugReport } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';

// User-submitted bug reports (Profile -> Report a bug). Admins triage them
// via /api/admin (action=bugReports / setBugStatus).
export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const report = await createBugReport(me.id, String(body.body || ''), body.screen ? String(body.screen) : null);
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Bug report error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: error?.status || 500 });
  }
}
