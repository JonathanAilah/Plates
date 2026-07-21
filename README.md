# Plates — Full admin dashboard + seller approval flow

Adds an admin dashboard with real powers, plus the seller-approval workflow you asked for.

## What changed

### Seller onboarding
Before: toggling "Seller mode" instantly made you a seller.
After: toggling seller mode opens the Kitchen Profile screen. When the required fields are complete (legal name, kitchen name, cottage-food attestation, permit answer, address), a green "Ready to submit" card appears. Tapping "Submit for review" moves them to **pending**.

### Seller states
- `not_seller` (default)
- `pending` — waiting for admin review, shows yellow banner
- `approved` — can post dishes, appears on Discover
- `rejected` — sees red banner with reason, can edit + resubmit
- `suspended` — dishes hidden from Discover, sees red banner with reason
- `account_disabled` — separate switch, hides everywhere

### Admin dashboard
Accessible via a **shield icon top-right of Discover** (only visible to admins). Icon turns red with a pending count when there are sellers awaiting review.

Screens:
- **Dashboard** — stats tiles (users, sellers, dishes, orders), red banner if pending sellers waiting, quick links
- **Pending sellers** — one-page view of each pending seller's kitchen profile (address, permit, hours, dietary flags, cottage food attestation), Approve or Reject inline (Reject requires a reason)
- **All users** — searchable, filterable list (All / Pending / Sellers / Suspended / Admins / Disabled)
- **User detail** — profile, order stats, seller status controls, account controls (disable, promote/demote admin), recent order history
- **Dish moderation** — searchable list of ALL dishes with delete button. Solves your "old photoless dishes" problem — search for empty, delete them individually, or filter by "no photo" (the muted red tag next to each)

### Safety
- All admin endpoints server-side gated by `requireAdmin()`
- Admin can't disable or demote themselves (would lock themselves out)
- Deleting a dish is admin-confirmed via native browser confirm dialog
- Rejection and suspension reasons are required and shown to the affected user
- Approved+non-disabled sellers only appear on Discover — suspended/disabled sellers vanish from browsing

## Prerequisites

You need `role = 'admin'` on your own user record. Since we set this up in the auth session, in Neon SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE clerk_user_id = 'YOUR_CLERK_ID_HERE';
```

To find your Clerk ID: `SELECT id, name, clerk_user_id FROM users WHERE clerk_user_id IS NOT NULL ORDER BY id DESC LIMIT 5;`

You did this in the auth session — but if you skipped it, do it now.

## Files

- `lib/db.ts` — new columns (seller_status, rejection_reason, account_disabled, suspended_reason), admin DB helpers, dish query now filters approved+non-disabled sellers
- `app/api/admin/route.ts` — NEW, all admin endpoints
- `app/api/users/route.ts` — new submitForReview action, toggleSeller now only supports turning OFF
- `app/api/dishes/route.ts` — create action blocked unless seller_status = 'approved'
- `app/page.tsx` — admin screens + status banners + seller flow rework

## How to install

1. Extract this zip.
2. Copy files into your local Plates repo:
   - `app/api/admin/` folder is NEW — contains `route.ts`
   - Everything else overwrites existing files
3. GitHub Desktop should show 5 changed files (1 new folder).
4. Commit: `Add admin dashboard + seller approval workflow`
5. Push origin — Vercel auto-deploys

## Immediate cleanup of the old photoless dishes

After the deploy is live and you've signed in as admin:

**Option A — nuke via SQL** (fastest):
```sql
DELETE FROM dishes WHERE photo_url IS NULL;
```

**Option B — via the app** (uses the new admin feature):
1. Sign in as admin, tap the shield icon
2. Dish moderation → each dish without a photo shows "no photo" in red
3. Tap the trash icon on each to delete

**Option C — fix the seeded sellers so their old dishes reappear** (if they had been created under a pending seller):
The seed dishes in your DB were created under sellers with `is_seller = true` — so my migration backfilled them all to `seller_status = 'approved'`. They should show up normally. If some don't, run:
```sql
UPDATE users SET seller_status = 'approved' WHERE email LIKE '%.seed@plates.local';
```

## What to test

**As admin:**
1. Sign in. Tap the shield icon in Discover header — dashboard opens.
2. Tap "All users" → see your seeded cooks with "approved" tags.
3. Tap "Dish moderation" → try deleting one of the photoless dishes.

**As a would-be seller (sign in on another browser or incognito):**
1. Sign up as a new user.
2. Profile → toggle Seller mode → Kitchen profile opens.
3. Fill everything out. "Ready to submit" card appears at bottom of Kitchen dashboard.
4. Tap Submit. Kitchen dashboard shows the yellow "Under review" banner.

**Back to admin (first browser):**
5. Shield icon should now show a red pending badge.
6. Tap it → dashboard shows "1 pending seller" as a red banner.
7. Tap it → see the pending seller's info card. Approve or Reject them (Reject requires a reason).

**Back to would-be seller:**
8. Refresh. If approved, "Under review" banner is gone and you can Add to menu. If rejected, see the red banner with the reason and a Resubmit button.

## Known limits

- No email notifications when admins approve/reject/suspend. In-app only. Add email later with a Resend integration if you want.
- Rejection reason is visible to the rejected user. Don't put anything private in there.
- Deleting a user via the admin page isn't a feature — only "disable account" (soft delete). If you truly want to remove a row, that's still SQL.
- Admin actions aren't audited (no history log). If you want to see who approved whom and when, we'd need an audit_log table.
