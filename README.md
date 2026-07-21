# Plates — Order tracking + kitchen queue

Ends the fake `setTimeout` that auto-marked orders "ready" after 3 seconds. Now the cook drives the whole flow.

## What changed

**Status flow (5 real states):**
`placed → accepted → cooking → ready → picked_up`
Either side can cancel while status is `placed` or `accepted`.

**Buyer side**
- New **Your orders** screen: list of all orders with status pill + time ago
- New **Order details** screen: big status header with progress dots, pickup code shown in green when order is Ready, item card, cook + pickup info, pickup map with Get directions button, Cancel button (while cancellable)
- Live updates via polling every 5s while the tab is active (respects `document.hidden` for battery)
- Access point: **Profile → Your orders** (with active-count badge)

**Cook side**
- New **Kitchen queue** screen accessible from Seller Dashboard
- Each order shows buyer name, item, price, time
- Status-appropriate action buttons: Decline / Accept order → Start cooking → Mark ready → Mark picked up
- Completed and cancelled orders are dimmed but still visible

**Under the hood**
- `orders.pickup_code` — auto-generated 4-digit code at checkout, ready for feature #3 (pickup confirmation)
- Legacy orders with `status='processing'` are migrated to `status='placed'` on startup
- API endpoint whitelists valid statuses

## Files (3 replacements, no new files)

- `lib/db.ts` — pickup_code column, migration, rich getOrders/getSellerOrders, pickup code generation in checkoutCart
- `app/api/orders/route.ts` — removed the fake setTimeout, added status whitelist
- `app/page.tsx` — 3 new screens, polling, live status handling

## How to install

1. Extract this zip.
2. Copy each file into your local Plates repo at the matching path — all replacements.
3. GitHub Desktop should show 3 changed files.
4. Commit: `Order tracking + kitchen queue with real status flow`
5. Push origin — Vercel auto-deploys.

## What to test after deploy

**As a buyer:**
1. Add a dish to cart → Place order.
2. You'll land on Your Orders. Tap into the order.
3. Status should say "Order placed · Waiting for cook to accept…" with 1/5 progress dots filled.
4. Leave this tab open — the page will refresh the status every 5 seconds automatically.

**As a cook (in another browser tab or another device):**
1. Toggle Seller mode ON, go to Cook.
2. You'll see a "Kitchen queue" card with an active-count badge. Tap it.
3. Your incoming order should be there. Tap **Accept order**.
4. Then **Start cooking** → **Mark ready** → **Mark picked up**.

**Back as the buyer:** the status updates on its own within 5 seconds. When Ready, a big green pickup code appears (that's the foundation for the next feature).

## Known limitations

- No push notifications — cook only sees new orders if they open the Kitchen queue screen (or if their tab happens to be open on it when the order arrives). Real push needs a service like OneSignal or FCM.
- Polling is a compromise. A real-time service (Pusher, Ably, Supabase Realtime) would be smoother but adds a dependency.
