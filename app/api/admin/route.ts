import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { requireAdmin } from '@/lib/auth';
import {
  getPendingSellers,
  getAllUsersForAdmin,
  getUserDetailForAdmin,
  approveSeller,
  rejectSeller,
  suspendSeller,
  unsuspendSeller,
  setAccountDisabled,
  setUserRole,
  getAllDishesForAdmin,
  adminDeleteDish,
  getAdminStats,
  getAdminUserOrders,
  getAdminFinancials,
  deleteUserCompletely,
  updatePlatformSettings,
} from '@/lib/db';

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stats') {
      const stats = await getAdminStats();
      return NextResponse.json(stats);
    }

    if (action === 'pending') {
      const users = await getPendingSellers();
      return NextResponse.json(users);
    }

    if (action === 'users') {
      const filter = searchParams.get('filter') || 'all';
      const search = searchParams.get('search') || undefined;
      const users = await getAllUsersForAdmin(filter, search);
      return NextResponse.json(users);
    }

    if (action === 'userDetail') {
      const userId = parseInt(searchParams.get('userId') || '0');
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      const detail = await getUserDetailForAdmin(userId);
      if (!detail) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json(detail);
    }

    if (action === 'userOrders') {
      const userId = parseInt(searchParams.get('userId') || '0');
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      const orders = await getAdminUserOrders(userId);
      return NextResponse.json(orders);
    }

    if (action === 'financials') {
        const financials = await getAdminFinancials();
        return NextResponse.json(financials);
    }

    if (action === 'dishes') {
      const search = searchParams.get('search') || undefined;
      const dishes = await getAllDishesForAdmin(search);
      return NextResponse.json(dishes);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireAdmin();
    const body = await request.json();
    const { action, userId, dishId, reason } = body;

    if (action === 'updateSettings') {
      const settings = await updatePlatformSettings(body.settings || {});
      return NextResponse.json(settings);
    }

    if (action === 'approveSeller') {
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      const user = await approveSeller(userId);
      return NextResponse.json(user);
    }

    if (action === 'rejectSeller') {
      if (!userId || !reason) return NextResponse.json({ error: 'userId and reason required' }, { status: 400 });
      const user = await rejectSeller(userId, String(reason).trim().slice(0, 500));
      return NextResponse.json(user);
    }

    if (action === 'suspendSeller') {
      if (!userId || !reason) return NextResponse.json({ error: 'userId and reason required' }, { status: 400 });
      const user = await suspendSeller(userId, String(reason).trim().slice(0, 500));
      return NextResponse.json(user);
    }

    if (action === 'unsuspendSeller') {
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      const user = await unsuspendSeller(userId);
      return NextResponse.json(user);
    }

    if (action === 'setDisabled') {
      if (!userId || typeof body.disabled !== 'boolean') {
        return NextResponse.json({ error: 'userId and disabled required' }, { status: 400 });
      }
      // Prevent admins from disabling themselves (would lock them out)
      if (userId === me.id) return NextResponse.json({ error: 'Cannot disable your own account' }, { status: 400 });
      const user = await setAccountDisabled(userId, body.disabled);
      return NextResponse.json(user);
    }

    if (action === 'setRole') {
      if (!userId || (body.role !== 'user' && body.role !== 'admin')) {
        return NextResponse.json({ error: 'userId and valid role required' }, { status: 400 });
      }
      // Prevent admins from demoting themselves (would lose access mid-session)
      if (userId === me.id && body.role !== 'admin') {
        return NextResponse.json({ error: 'Cannot demote your own account' }, { status: 400 });
      }
      const user = await setUserRole(userId, body.role);
      return NextResponse.json(user);
    }

    if (action === 'deleteDish') {
      if (!dishId) return NextResponse.json({ error: 'dishId required' }, { status: 400 });
      await adminDeleteDish(dishId);
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteUser') {
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
      // Never let an admin delete their own account
      if (userId === me.id) {
        return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
      }

      // Run the DB-side deletion (refunds open orders, snapshots order data,
      // deletes dependent rows, returns Blob URLs to clean up).
      const result = await deleteUserCompletely(userId);

      // Blob cleanup runs AFTER the DB commit. If any Blob delete fails,
      // log it — the user row is already gone, so we don't want to fail
      // the whole request. Orphan blobs can be cleaned up later.
      let blobDeleteFailures = 0;
      for (const url of result.blobUrlsToDelete) {
        try {
          await del(url);
        } catch (err) {
          blobDeleteFailures++;
          console.error('Blob delete failed for', url, err);
        }
      }

      return NextResponse.json({
        success: true,
        deletedUserEmail: result.deletedUserEmail,
        refundedOrderCount: result.refundedOrderCount,
        preservedOrderCount: result.preservedOrderCount,
        blobsDeleted: result.blobUrlsToDelete.length - blobDeleteFailures,
        blobDeleteFailures,
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin POST error:', error);
    return errorResponse(error);
  }
}
