import { NextRequest, NextResponse } from 'next/server';
import { getMenuInvite, submitMenuInvite, initializeDatabase } from '@/lib/db';

// Public menu form for venue vendors. The festival owner shares a tokenized
// link; the vendor fills in their menu without needing a Plates account.
// The token is the only credential — it's single-use and unguessable.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase();
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
    const invite = await getMenuInvite(token);
    if (!invite) return NextResponse.json({ error: 'This menu form link is not valid' }, { status: 404 });
    return NextResponse.json(invite);
  } catch (error: any) {
    console.error('STL form GET error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: error?.status || 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase();
    const body = await request.json();
    const token = String(body.token || '');
    if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });
    const items = (Array.isArray(body.items) ? body.items : [])
      .map((i: any) => ({
        name: String(i?.name || '').trim(),
        price: Math.round((Number(i?.price) || 0) * 100) / 100,
        description: i?.description ? String(i.description) : null,
      }))
      .filter((i: any) => i.name && i.price > 0 && i.price <= 10000);
    if (items.length === 0) {
      return NextResponse.json({ error: 'Add at least one menu item with a name and price' }, { status: 400 });
    }
    const result = await submitMenuInvite(token, items, body.vendorDescription ? String(body.vendorDescription) : null);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('STL form POST error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: error?.status || 500 });
  }
}
