import { NextRequest, NextResponse } from 'next/server';
import {
  getUser, updateUserSeller, updateUserLocation, updateUserAddress,
  updateUserProfile, updateCookProfile, initializeDatabase,
} from '@/lib/db';
import { getSessionUser, requireSessionUser } from '@/lib/auth';

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    // Returns the currently signed-in user's profile, or null if not signed in
    const user = await getSessionUser();
    return NextResponse.json(user);
  } catch (error) {
    console.error('User GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // init is public — no auth needed (used once on app boot to run migrations)
    if (action === 'init') {
      await initializeDatabase();
      return NextResponse.json({ success: true });
    }

    // Everything else requires a signed-in user
    const me = await requireSessionUser();

    if (action === 'get') {
      // Fetch another user by ID — only public-safe fields (already the case in getUser)
      const user = await getUser(body.id);
      return NextResponse.json(user);
    }

    if (action === 'toggleSeller') {
      const user = await updateUserSeller(me.id, body.isSeller);
      return NextResponse.json(user);
    }

    if (action === 'updateLocation') {
      const user = await updateUserLocation(me.id, body.latitude, body.longitude);
      return NextResponse.json(user);
    }

    if (action === 'updateAddress') {
      const user = await updateUserAddress(me.id, body.address, body.latitude, body.longitude);
      return NextResponse.json(user);
    }

    if (action === 'updateProfile') {
      const user = await updateUserProfile(me.id, body.name, body.bio, body.photoUrl ?? null);
      return NextResponse.json(user);
    }

    if (action === 'updateCookProfile') {
      const user = await updateCookProfile(me.id, {
        legalName: body.legalName,
        kitchenName: body.kitchenName,
        cottageFoodAttested: body.cottageFoodAttested,
        hasPermit: body.hasPermit,
        permitNumber: body.permitNumber,
        kitchenFlags: body.kitchenFlags,
        cookingHours: body.cookingHours,
        pickupDescription: body.pickupDescription,
      });
      return NextResponse.json(user);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('User API error:', error);
    return errorResponse(error);
  }
}
