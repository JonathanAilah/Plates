import { NextRequest, NextResponse } from 'next/server';
import { createBugReport, getBugAlertRecipients } from '@/lib/db';
import { requireSessionUser } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push';

// User-submitted bug reports (Profile -> Report a bug). Staff triage them
// via /api/admin (action=bugReports / setBugStatus).
export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const report = await createBugReport(me.id, String(body.body || ''), body.screen ? String(body.screen) : null);

    // Alert customer-service staff on every new report. Push failures must
    // never fail the report itself.
    try {
      const recipients = await getBugAlertRecipients();
      const preview = String(body.body || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      await Promise.all(recipients.map(r => sendPushToUser(r.id, {
        title: '🐛 New bug report',
        body: `${me.name || 'A user'}: ${preview}`,
        url: '/',
      })));
    } catch (pushErr) {
      console.error('Bug report push alert failed:', pushErr);
    }

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Bug report error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: error?.status || 500 });
  }
}
