# Plates — Pickup time picker (15 min → 2 hr)

Replaced the useless ASAP/Schedule toggle with a real duration slider. Buyer picks 15-120 min, cook sees the pickup clock time on their kitchen queue.

## What changed

**Cart screen: new pickup time card**
Instead of two identical-looking ASAP/Schedule buttons that did nothing, there's now a compact card with:
- Big number showing the chosen duration ("30 minutes" or "1h 30m")
- Small preview showing the actual clock time it converts to (e.g. "~6:47 PM")
- A slider from 15 to 120 minutes in 15-minute steps
- Labels at the endpoints: 15 min · 30 min · 1 hr · 2 hr

Default is 30 minutes (a reasonable middle ground).

**Backend: pickup_at timestamp on orders**
- New column `orders.pickup_at TIMESTAMP` — the actual clock time the buyer expects to pick up
- Computed at order placement: `now + selected duration`
- `createOrder`, `checkoutCart`, and the cart API all pass this through

**Buyer's Order Detail: pickup time card**
Below the status header (only shown while order is active, not for picked-up/cancelled):
- "PICKUP TIME" header
- Clock time (e.g. "6:47 PM")
- Relative time: "in 32 min" — and if you're overdue, "Overdue by 5 min ago" with a yellow warning color

**Cook's Kitchen Queue: pickup chip on each order row**
Chip next to the status pill:
- "🔔 6:47 PM · in 32 min" — helps cooks pace their prep
- Turns yellow with "overdue X min ago" if the buyer hasn't arrived by their picked time

**The old ASAP/Schedule toggle is completely removed.**
The `pickupTiming` state variable is gone. Replaced by `pickupDurationMin` (a number, default 30).

## Files

- `lib/db.ts` — pickup_at column added; createOrder + checkoutCart accept it; getOrders + getSellerOrders SELECT it
- `app/api/cart/route.ts` — passes pickupAt through to checkoutCart
- `app/page.tsx` — replaces toggle with slider, adds formatPickupAt helper, displays on order detail and kitchen queue

## Install

1. Extract this zip.
2. Copy files into your local repo, overwriting.
3. Commit: `Replace pickup toggle with 15-120 min duration slider`
4. Push origin — Vercel auto-deploys.

Migration runs automatically on next app load. Existing orders will have `pickup_at = NULL`, which is fine — they just won't show the pickup card.

## What to test

**As buyer:**
1. Add something to cart. Cart screen shows the new pickup slider.
2. Default is 30 minutes. Big number reads "30 minutes". Small text shows a clock time 30 min from now.
3. Drag slider to 90. Shows "1h 30m" and updated clock time.
4. Tap Place order.
5. Open Order Detail → sees a "PICKUP TIME" card with the clock time and "in ~90 min".

**As cook:**
6. Open kitchen queue. On that new order, see a terracotta chip "🔔 8:17 PM · in 89 min" next to the status.
7. Wait until the pickup time passes — the chip turns yellow and shows "overdue X min ago".

## Design decisions

- **Timestamp not duration**: stored as an actual clock time so cooks see when to be ready without doing math. Also survives if you look at the order 12 hours later.
- **15-minute steps**: matches how humans think about time. 27 minutes isn't a useful precision.
- **No "ASAP"**: 15 minutes IS ASAP for home-cooked food. If a cook is at their station with a hot pan, 15 min is realistic. Anything faster is unrealistic anyway.
- **Overdue is visual, not blocking**: we don't cancel or block anything if the buyer is late. Real life has traffic. Cook sees the flag and can act accordingly.
