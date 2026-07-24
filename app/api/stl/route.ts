import { NextRequest, NextResponse } from 'next/server';
import {
  createVenue, getVenues, getMyVenues, getVenueDetail,
  registerVendor, addVenueVendor, getMyVendor, getApprovedStandaloneVendors,
  getVendorDetail, canManageVendor, addVendorMenuItem, deleteVendorMenuItem,
  createMenuInvite, initializeDatabase,
} from '@/lib/db';
import { getSessionUser, requireSessionUser } from '@/lib/auth';

// Skip the Line: venues (festivals/concerts/stadiums), real-business
// vendors, and their menus. Browsing is public; everything that mutates
// requires the session user to own the vendor or its venue.
export const dynamic = 'force-dynamic';

const VENUE_TYPES = ['festival', 'concert', 'stadium', 'fair', 'other'];
const BUSINESS_TYPES = ['restaurant', 'food_truck', 'stadium_booth', 'festival_vendor', 'caterer', 'other'];

function errorResponse(error: any) {
  const status = error?.status || 500;
  return NextResponse.json({ error: error?.message || 'Internal server error' }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'browse') {
      await initializeDatabase();
      const me = await getSessionUser();
      const [venues, vendors, myVendor, myVenues] = await Promise.all([
        getVenues(),
        getApprovedStandaloneVendors(),
        me ? getMyVendor(me.id) : Promise.resolve(null),
        me ? getMyVenues(me.id) : Promise.resolve([]),
      ]);
      return NextResponse.json({ venues, vendors, myVendor, myVenues });
    }

    if (action === 'venue') {
      const venueId = parseInt(searchParams.get('venueId') || '0');
      if (!venueId) return NextResponse.json({ error: 'venueId required' }, { status: 400 });
      const detail = await getVenueDetail(venueId);
      if (!detail) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
      const me = await getSessionUser();
      const isOwner = !!me && detail.venue.owner_user_id === me.id;
      // Invite tokens are secrets — only the venue owner gets them
      return NextResponse.json({ ...detail, invites: isOwner ? detail.invites : [], isOwner });
    }

    if (action === 'vendor') {
      const vendorId = parseInt(searchParams.get('vendorId') || '0');
      if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });
      const detail = await getVendorDetail(vendorId);
      if (!detail) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      const me = await getSessionUser();
      const canManage = me ? await canManageVendor(me.id, vendorId) : false;
      return NextResponse.json({ ...detail, canManage });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('STL GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireSessionUser();
    const body = await request.json();
    const action = body.action;

    if (action === 'registerVendor') {
      const name = String(body.name || '').trim();
      if (name.length < 2) return NextResponse.json({ error: 'Business name required' }, { status: 400 });
      const businessType = BUSINESS_TYPES.includes(body.businessType) ? body.businessType : 'other';
      if (!body.permitUrl) return NextResponse.json({ error: 'Upload your permit or license to register' }, { status: 400 });
      const existing = await getMyVendor(me.id);
      if (existing) return NextResponse.json({ error: 'You already have a registered business' }, { status: 409 });
      const vendor = await registerVendor(me.id, {
        name, businessType,
        description: body.description ? String(body.description) : null,
        permitUrl: String(body.permitUrl),
        photoUrl: body.photoUrl ? String(body.photoUrl) : null,
      });
      return NextResponse.json(vendor);
    }

    if (action === 'createVenue') {
      const name = String(body.name || '').trim();
      if (name.length < 2) return NextResponse.json({ error: 'Event name required' }, { status: 400 });
      const venue = await createVenue(me.id, {
        name,
        venueType: VENUE_TYPES.includes(body.venueType) ? body.venueType : 'other',
        description: body.description ? String(body.description) : null,
        location: body.location ? String(body.location) : null,
        startsOn: body.startsOn || null,
        endsOn: body.endsOn || null,
      });
      return NextResponse.json(venue);
    }

    if (action === 'addVenueVendor') {
      const venueId = parseInt(body.venueId);
      const name = String(body.name || '').trim();
      if (!venueId || name.length < 2) return NextResponse.json({ error: 'venueId and vendor name required' }, { status: 400 });
      const businessType = BUSINESS_TYPES.includes(body.businessType) ? body.businessType : 'festival_vendor';
      const vendor = await addVenueVendor(me.id, venueId, name, businessType);
      return NextResponse.json(vendor);
    }

    if (action === 'addMenuItem') {
      const vendorId = parseInt(body.vendorId);
      const name = String(body.name || '').trim();
      const price = Number(body.price);
      if (!vendorId || !name || !Number.isFinite(price) || price <= 0 || price > 10000) {
        return NextResponse.json({ error: 'vendorId, name, and a valid price are required' }, { status: 400 });
      }
      if (!(await canManageVendor(me.id, vendorId))) {
        return NextResponse.json({ error: 'Not your vendor' }, { status: 403 });
      }
      const item = await addVendorMenuItem(vendorId, {
        name,
        price: Math.round(price * 100) / 100,
        description: body.description ? String(body.description) : null,
      });
      return NextResponse.json(item);
    }

    if (action === 'deleteMenuItem') {
      const vendorId = parseInt(body.vendorId);
      const itemId = parseInt(body.itemId);
      if (!vendorId || !itemId) return NextResponse.json({ error: 'vendorId and itemId required' }, { status: 400 });
      if (!(await canManageVendor(me.id, vendorId))) {
        return NextResponse.json({ error: 'Not your vendor' }, { status: 403 });
      }
      const result = await deleteVendorMenuItem(itemId, vendorId);
      return NextResponse.json(result);
    }

    if (action === 'createMenuInvite') {
      const vendorId = parseInt(body.vendorId);
      if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });
      if (!(await canManageVendor(me.id, vendorId))) {
        return NextResponse.json({ error: 'Not your vendor' }, { status: 403 });
      }
      const invite = await createMenuInvite(vendorId);
      return NextResponse.json(invite);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('STL POST error:', error);
    return errorResponse(error);
  }
}
