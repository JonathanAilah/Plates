import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { requireStaff } from '@/lib/auth';
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
  getAllOrdersForAdmin,
  getAllCooksForAdminPayouts,
  getCookPayoutDetail,
  getBugReports,
  setBugReportStatus,
  getUserRoleById,
  getAdminFinanceBreakdown,
  getSellersForAdmin,
  getVendorApplications,
  setVendorStatus,
} from '@/lib/db';

// Staff tiers: chief admins ('admin') see everything; secondary admins see
// everything EXCEPT financials, pricing, and role/user management; support
// (customer service) only handles bug reports.
const forbidden = () => NextResponse.json({ error: 'Not authorized for this action' }, { status: 403 });

function errorResponse(error: any) {
  const status = error?.status || 500;
  const message = error?.message || 'Internal server error';
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const me = await requireStaff();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';

    const chief = me.role === 'admin';
    const moderator = chief || me.role === 'secondary_admin';
    // Financial data is chief-admin only; general moderation data needs at
    // least secondary admin; bug reports are open to all staff (support).
    const CHIEF_ONLY = ['financials', 'financeBreakdown', 'ordersList', 'cooksPayouts', 'cookPayoutDetail'];
    const MODERATOR_ONLY = ['stats', 'pending', 'users', 'userDetail', 'userOrders', 'dishes', 'sellersList', 'vendorApplications'];
    if (CHIEF_ONLY.includes(action) && !chief) return forbidden();
    if (MODERATOR_ONLY.includes(action) && !moderator) return forbidden();

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

    if (action === 'financeBreakdown') {
      const breakdown = await getAdminFinanceBreakdown();
      return NextResponse.json(breakdown);
    }

    if (action === 'vendorApplications') {
      const apps = await getVendorApplications();
      return NextResponse.json(apps);
    }

    if (action === 'sellersList') {
      const pickup = parseInt(searchParams.get('maxPickupMin') || '0');
      const sellers = await getSellersForAdmin({
        environment: searchParams.get('environment') || null,
        flag: searchParams.get('flag') || null,
        maxPickupMin: Number.isFinite(pickup) && pickup > 0 ? pickup : null,
      });
      return NextResponse.json(sellers);
    }

    if (action === 'dishes') {
      const search = searchParams.get('search') || undefined;
      const dishes = await getAllDishesForAdmin(search);
      return NextResponse.json(dishes);
    }

    if (action === 'bugReports') {
      const status = searchParams.get('status');
      const reports = await getBugReports(status === 'open' || status === 'resolved' ? status : null);
      return NextResponse.json(reports);
    }

    // Financial drill-down: behind each Financials card.
    if (action === 'ordersList') {
      const num = (v: string | null): number | undefined => {
        if (v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      const orders = await getAllOrdersForAdmin({
        search: searchParams.get('search'),
        status: searchParams.get('status'),
        limit: num(searchParams.get('limit')),
        offset: num(searchParams.get('offset')),
      });
      return NextResponse.json(orders);
    }

    if (action === 'cooksPayouts') {
      const num = (v: string | null): number | undefined => {
        if (v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      const cooks = await getAllCooksForAdminPayouts({
        search: searchParams.get('search'),
        limit: num(searchParams.get('limit')),
        offset: num(searchParams.get('offset')),
      });
      return NextResponse.json(cooks);
    }

    if (action === 'cookPayoutDetail') {
      const cookId = parseInt(searchParams.get('cookId') || '0');
      if (!cookId) return NextResponse.json({ error: 'cookId required' }, { status: 400 });
      const num = (v: string | null): number | undefined => {
        if (v == null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };
      const detail = await getCookPayoutDetail(cookId, {
        pastLimit: num(searchParams.get('pastLimit')),
        pastOffset: num(searchParams.get('pastOffset')),
      });
      if (!detail) return NextResponse.json({ error: 'Cook not found' }, { status: 404 });
      return NextResponse.json(detail);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin GET error:', error);
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const me = await requireStaff();
    const body = await request.json();
    const { action, userId, dishId, reason } = body;

    const chief = me.role === 'admin';
    const moderator = chief || me.role === 'secondary_admin';
    // Pricing and permanent deletion stay with the chief admin — admins can
    // disable accounts but never delete them. Seller/dish moderation and role
    // changes need at least admin (setRole is further restricted below). Bug
    // triage (setBugStatus) is open to all staff, including support.
    const CHIEF_ONLY = ['updateSettings', 'deleteUser'];
    const MODERATOR_ONLY = ['approveSeller', 'rejectSeller', 'suspendSeller', 'unsuspendSeller', 'setDisabled', 'deleteDish', 'setRole', 'setVendorStatus'];
    if (CHIEF_ONLY.includes(action) && !chief) return forbidden();
    if (MODERATOR_ONLY.includes(action) && !moderator) return forbidden();

    // Admins manage members and support staff — accounts holding an admin or
    // chief-admin role can only be acted on by the chief.
    if (!chief && userId && ['setDisabled', 'suspendSeller', 'rejectSeller', 'setRole'].includes(action)) {
      const targetRole = await getUserRoleById(userId);
      if (targetRole === 'admin' || targetRole === 'secondary_admin') return forbidden();
    }

    if (action === 'setBugStatus') {
      const status = body.status === 'resolved' ? 'resolved' : 'open';
      const report = await setBugReportStatus(parseInt(body.reportId), status);
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      return NextResponse.json(report);
    }

    if (action === 'setVendorStatus') {
      const vendorId = parseInt(body.vendorId);
      const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : null;
      if (!vendorId || !status) return NextResponse.json({ error: 'vendorId and valid status required' }, { status: 400 });
      const vendor = await setVendorStatus(vendorId, status);
      if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      return NextResponse.json(vendor);
    }

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
      const VALID_ROLES = ['user', 'admin', 'secondary_admin', 'support'];
      if (!userId || !VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'userId and valid role required' }, { status: 400 });
      }
      // Admins may only grant/remove Support — creating admins or chief
      // admins is reserved for the chief.
      if (!chief && body.role !== 'user' && body.role !== 'support') return forbidden();
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
