# Plates — Real authentication (Clerk)

Replaces the localStorage-based fake login with proper Clerk authentication.
This is prerequisite work for the admin page.

## What changed conceptually

**Before:** app auto-created a random anonymous user on first visit, stored `plates_user_id` in localStorage. Anyone with DevTools could impersonate any user by editing that value. Every API accepted `userId` from the client and trusted it.

**After:** Clerk manages accounts. Users sign in with email/password or Google. Server routes use `requireSessionUser()` which reads the Clerk session, not the client. No user impersonation possible.

**Anonymous browsing preserved.** Non-signed-in users can still browse the Discover feed. Clicking any action (order, cart, message, become seller) shows Clerk's sign-in modal.

## New files

- `middleware.ts` (at repo root) — Clerk middleware, required for auth() to work in API routes
- `lib/auth.ts` — server-side helper: `getSessionUser()`, `requireSessionUser()`, `requireAdmin()`

## Modified files

- `package.json` — adds `@clerk/nextjs`
- `app/layout.tsx` — wraps everything in `<ClerkProvider>`, themed to your palette
- `app/page.tsx` — removes localStorage init, adds anonymous Discover view, adds `<UserButton>` on Profile, calls `/api/users` GET to load the session user
- `app/api/users/route.ts` — GET returns session user; POST uses `requireSessionUser()`
- `app/api/dishes/route.ts` — all writes verify ownership via session
- `app/api/cart/route.ts` — cart operations use session user
- `app/api/orders/route.ts` — status transitions verify buyer/seller relationship
- `app/api/messages/route.ts` — participant checks use session user
- `lib/db.ts` — adds `clerk_user_id` and `role` columns to users; adds `getUserByClerkId`, `createUserFromClerk`, `isAdmin`

## Prerequisites (you already did these)

You added these to Vercel:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

If you want to test locally too, add them to `.env.local` as well.

## How to install

1. Extract this zip.
2. Copy each file into your local Plates repo at the matching path:
   - `middleware.ts` — NEW, goes at repo root (same folder as `package.json`)
   - `lib/auth.ts` — NEW
   - `package.json` — overwrite (adds @clerk/nextjs dependency)
   - Everything else overwrites existing files
3. In terminal: `npm install` (picks up new dependency)
4. GitHub Desktop should show ~10 changed files (make sure `middleware.ts` is included at repo root)
5. Commit: `Add Clerk authentication, remove localStorage-based fake login`
6. Push origin — Vercel auto-deploys

## Critical: data migration for your existing accounts

**Every existing user in your DB has `clerk_user_id = NULL`.** When you sign in via Clerk after this deploys, my auth helper won't find you by Clerk ID and will create a NEW profile. Your existing dishes, orders, cart, etc. would be orphaned under the old user, and the new Clerk-linked profile would be empty.

You have two paths:

### Path A: Just start fresh (easiest)

If you don't care about your test data, skip migration. Sign in via Clerk, get a fresh profile, and re-add anything you want to keep.

The mockup seed dishes are unaffected because they never had Clerk users anyway — they'll still appear on the Discover feed under their original cook names.

### Path B: Manually link your account (preserves your data)

After you deploy and sign in via Clerk ONCE (so Clerk knows about you and creates your first Postgres profile), you'll want to merge your OLD test user into your new Clerk-linked one.

1. Deploy this update.
2. Visit the live site, click "Sign in" (top right), sign up with your email.
3. This creates a NEW row in your users table for you (with `clerk_user_id` set).
4. Open Neon SQL Editor.
5. Find your OLD user (the one that had all your test dishes):
   ```sql
   SELECT id, name, email, clerk_user_id FROM users ORDER BY id;
   ```
6. Say old ID is 3 and new (Clerk-linked) ID is 42. Run:
   ```sql
   -- Transfer everything owned by old user to new user
   UPDATE dishes SET seller_id = 42 WHERE seller_id = 3;
   UPDATE orders SET buyer_id = 42 WHERE buyer_id = 3;
   UPDATE cart_items SET buyer_id = 42 WHERE buyer_id = 3;
   UPDATE messages SET sender_id = 42 WHERE sender_id = 3;
   -- Then delete the old empty user
   DELETE FROM users WHERE id = 3;
   ```
7. Refresh the app. Everything is now under your Clerk-linked account.

## To make yourself admin (needed for next session's admin page)

After signing in via Clerk, run in Neon SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE clerk_user_id = 'YOUR_CLERK_ID_HERE';
```

To find your Clerk ID: Neon SQL Editor → `SELECT id, name, clerk_user_id FROM users WHERE clerk_user_id IS NOT NULL;` — that returns your row after you've signed in.

## What to test after deploying

1. Open the site in an incognito window (no cookies) — you should see the anonymous Discover view with a "Sign in" button top-right and a "Sign in to order" chip on each dish.
2. Click Sign in. Clerk modal opens. Try email/password sign-up.
3. After signing up, you should see the full app (bottom nav appears, tap into a dish, order it, etc.).
4. Try DevTools → Application → LocalStorage — no `plates_user_id` anymore.
5. On Profile tab, top-right you see your Clerk avatar/UserButton — click it to see the "Sign out" option.
6. Try Google sign-in in another incognito window.

## Known followups

- **Admin page** is next session's work. This just laid the groundwork with the `role` column and `requireAdmin()` helper.
- The old anonymous-created users in your DB are still there, taking up rows. Optional cleanup: `DELETE FROM users WHERE clerk_user_id IS NULL AND email LIKE 'user_%@plates.local';` (deletes only the auto-created anonymous accounts, leaves your seed cooks intact).
- On first sign-in, Clerk gives us a first name — we use it as the app's `name` field. Users can edit it on their Profile screen if they want.

## Rollback plan

If anything breaks and you want to revert quickly:
1. Vercel Deployments → find the previous good deploy → the ⋯ menu → "Promote to Production"
2. Your database still has the new `clerk_user_id` and `role` columns, but they're additive — the old code just ignores them.
