# Plates — Public cook profiles

Every approved cook now has a public shareable page. Tap a cook's name/avatar anywhere and their profile opens.

## What changed

**New public page: `/cook/[id]`**
Server-rendered, no auth required. Shareable URL that opens directly to a cook. Anyone with the link (even not signed in) sees the cook's page.

**What's on the profile:**
- Cook photo, kitchen name, real name (if different)
- Aggregate star rating across all their dishes ("★ 4.8 · 12 reviews")
- Bio (if set)
- Kitchen tags (nut-free, gluten-free, etc)
- Pickup description (freeform text)
- "Member since [month year]"
- Full menu — all their currently-posted, non-hidden dishes, with rating chips and prices. Featured dishes get a gold FEATURED badge.
- Recent community feed posts from the cook (active in last 24hr) — read-only view

**Tap-to-open links from everywhere:**
- Dish row on Discover → tapping the cook's name/avatar opens their profile (doesn't open the meal detail — click stopped)
- Meal detail page → seller card is now a link, with "View profile →" hint
- The main body of the dish card still opens the meal like before

**Dish visibility controls (schema + API only):**
- New columns `dishes.is_featured` and `dishes.is_hidden_from_profile`
- API supports `setFeatured` and `setHidden` actions
- **NOT yet exposed in the Kitchen dashboard UI** — this is a small follow-up. Cooks can't toggle these yet from the app, only via SQL if they want to test.

**404 for non-approved cooks.**
Only cooks with `seller_status = 'approved'` AND `account_disabled = false` are visible. Everyone else gets a 404 page, even by direct URL.

**SEO metadata.**
Each cook page has a proper `<title>` and description tag. Sharing on social will show "Cook Name · Plates" and their bio.

## Files

- `lib/db.ts` — new columns, `getCookPublicProfile`, `updateDishFeatured`, `updateDishHidden`
- `app/api/cooks/[id]/route.ts` — NEW public endpoint (no auth)
- `app/api/dishes/route.ts` — new `setFeatured` + `setHidden` actions
- `app/cook/[id]/page.tsx` — NEW server-rendered page
- `app/cook/[id]/CookProfileView.tsx` — NEW client component (styling)
- `app/page.tsx` — Dish interface expanded, tappable cook links added

## Install

1. Extract this zip.
2. Copy everything into your local repo — 3 new folders (`app/cook`, `app/api/cooks`, and its subfolder).
3. GitHub Desktop should show these as new files + a few modifications.
4. Commit: `Add public cook profile pages`
5. Push origin — Vercel auto-deploys.

Schema migrations run on next app load.

## What to test

**As anyone:**
1. On Discover, tap the cook's name (not the dish card body) on any dish row → cook profile opens.
2. On a meal detail page, tap the seller card at the bottom → cook profile opens.
3. On the profile, tap any dish → returns to main app on the meal detail (via `/?dish=id` link — note: this navigates but doesn't yet auto-open the meal, so you'll land on Discover).
4. Share the URL with someone — even without signing in, they can view.

**As an anonymous user:**
1. Sign out. Visit `plates-g9u9.vercel.app/cook/2` (or whichever id).
2. Full profile should load with no sign-in required.

**Try to break it:**
1. Visit `/cook/999999` — should 404.
2. Visit a pending cook's profile — should 404.
3. Visit your own admin/user (not-a-seller) profile — should 404.

## What was NOT built

- **Kitchen dashboard UI for featuring/hiding dishes.** Schema and API are ready. To use them, cooks would need buttons on their menu list. This is a ~1 hour follow-up.
- **Profile edit surface.** The bio and pickup description are already editable via existing Kitchen profile flows.
- **"Order from this cook" button on the profile page.** Buyers can tap a dish to view/order.
- **Following/subscribing to cooks.** Deliberate — you said no followers, proximity-first.
- **Direct message from profile.** Messaging is order-scoped in our system; not a cook-level channel.
- **Automatic open-meal deep link from profile.** Right now `/cook/5` links dishes as `/?dish=id`, which loads the app but doesn't jump to the meal. Fixable with a `useSearchParams` handler in `page.tsx` — small follow-up.

## Design decisions

- **Separate page, not in-app screen**: real public URLs, real SEO, real sharing. Trade-off: navigating away loses in-app scroll/state, but cart is DB-backed so it survives.
- **Community posts on profile are read-only**: reacting/commenting from here would require duplicating a lot of state and gating on anon users. Feed tab is the interactive surface.
- **Featured dishes sort first**: `ORDER BY d.is_featured DESC, d.created_at DESC`. Cooks can pin what they want to highlight.
- **Only approved cooks show**: consistent with how the marketplace already gates the feed.
