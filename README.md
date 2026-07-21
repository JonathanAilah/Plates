# Plates — Kitchen profile fixes

Fixes to the kitchen profile flow and adds "Where do you cook?" environment selector.

## What changed

**1. "Kitchen profile complete" text no longer misleads.**
Before: filling in all 7 sections turned the card green and said "Kitchen profile complete · Buyers see all your details" — but if you were still pending approval, that was wrong.

After: the card shows green ONLY when both filled AND approved.
- If not approved yet: "Kitchen details filled in · Waiting on admin approval to go live" (neutral tone, not green)
- If approved: "Kitchen details filled in · Buyers can see your kitchen" (green)
- If partial: "Complete your kitchen profile · X of 7 sections done"

**2. New "Where do you cook?" section (single-select).**
Options:
- Home kitchen
- Commercial kitchen
- Community kitchen
- Outdoor BBQ
- Food cart
- Food truck

Only ONE can be selected — cooks don't cook from a home kitchen AND a food truck at the same time. Stored in a new `users.kitchen_environment` column.

**3. Existing kitchen flags renamed "Kitchen conditions" for clarity.**
Still multi-select. Still contains: Pets in the home, Smokers in the home, Nut-free kitchen, Gluten-free kitchen.

## Admin approval is already working correctly

Verified: `getDishes()` filters `WHERE u.seller_status = 'approved'` — pending cooks' dishes do NOT appear on Discover. Dish creation is also blocked server-side unless approved. The approval chain is fully enforced.

## How admins log in

Same as regular users — via Clerk email/password or Google. The difference is what happens AFTER sign-in: if your Postgres user record has `role = 'admin'`, the shield icon appears on Discover.

**To promote yourself to admin, run this SQL in Neon:**
```sql
UPDATE users SET role = 'admin' WHERE clerk_user_id = 'YOUR_CLERK_USER_ID';
```

To find your clerk_user_id first:
```sql
SELECT id, name, email, clerk_user_id FROM users ORDER BY id DESC LIMIT 5;
```

Sign out and back in after running the update. The shield icon appears on the Discover header, tap it to enter admin.

## About ID + W-9 collection

**I pushed back on this feature and want to explain why:**

You asked to have the kitchen profile ask for a driver's license and link to a W-9 form. Both are legally sensitive and I don't recommend building this into the kitchen profile directly.

**Why:**
- **Storing ID means storing PII.** You'd take on legal obligations under GDPR, CCPA, and state privacy laws. You'd need encryption at rest, access audits, retention policies. You'd become an attractive target for identity theft attacks.
- **W-9s are Stripe's job.** W-9s are the US tax form platforms collect from contractors so they can issue 1099-NECs at year-end for payouts. When we build Stripe Connect Express (the next Tier-1 feature), cooks will complete their W-9 as part of Stripe's onboarding, Stripe stores it, and Stripe automatically generates their 1099s. Duplicating that work in your own system means doing it worse than Stripe would.
- **Duplication of KYC.** Stripe Connect requires government ID upload as part of their Know Your Customer process. Collecting IDs before Stripe means collecting them twice.

**My recommendation:** wait until we build payments (next tier-1 feature) and do all identity + tax collection through Stripe. When a cook is approved by an admin, they then complete Stripe onboarding, which handles ID verification and W-9 in one flow, hosted and secured by Stripe.

If you disagree and still want to collect ID/W-9 directly, we can do it, but I'd want to do it after we've talked through the storage requirements (dedicated encrypted table, no base64 in Postgres, admin-only access with audit logs, retention policy of 7 years for tax purposes).

## Files

- `lib/db.ts` — new `kitchen_environment` column + updateCookProfile accepts it
- `app/api/users/route.ts` — pass kitchenEnvironment through
- `app/page.tsx` — new "Where do you cook?" section, softened completion card wording

## Install

1. Extract this zip.
2. Copy files into your local repo, overwriting.
3. Commit: `Fix kitchen profile wording + add kitchen environment selector`
4. Push origin — Vercel auto-deploys.
5. To make yourself admin: run the SQL above in Neon SQL Editor.

## What to test

1. Sign in. Go to Cook → Kitchen profile.
2. Scroll to "Where do you cook?" — pick one. Tap same one again to unselect.
3. Save. Go back to Kitchen. If you're pending, the completion card should NOT be green.
4. Admin approves you (via `plates-g9u9.vercel.app` on your admin browser).
5. Refresh — completion card is now green with "Buyers can see your kitchen".
