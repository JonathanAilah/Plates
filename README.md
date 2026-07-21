# Plates — Fixes: cart checkout button + distance display

Two bugs fixed.

## Bug 1: "Place order" button was hidden

The cart screen and bottom nav were both `position: fixed; bottom: 0` — meaning the nav was rendered ON TOP of the Place order button, covering it. That's why you couldn't see or tap it.

**Fix:** hide the bottom nav bar on the cart screen. Cart already has a back arrow in its header for navigation. The "Cart" nav button pointing to a screen you're already on was redundant anyway.

## Bug 2: Distance / time mismatch

The dish list rows and meal detail were displaying "0.8 mi · 8 min pickup" — but the 8 min was made up (a formula: `15 + miles * 8`). When you tapped Show directions, Google returned real driving time via its DirectionsService, which is different because it accounts for actual roads.

The straight-line distance ("as the crow flies") is also different from Google's driving distance — Google's is usually 20-40% longer since it follows roads.

**Fix:** removed the fake "8 min pickup" text everywhere. Distance labels now use a tilde to signal they're approximate:
- Dish list row: `~0.8 mi` (was: `0.8 mi · 8 min`)
- Meal detail chip: `~0.8 mi away` (was: `0.8 mi · pickup ~8 min`)

When users tap **Show directions**, Google's DirectionsService returns the real driving distance and time, which shows in the "23 min · 3.2 mi by car" pill on that same screen. That's the authoritative number.

The `etaMinutes()` helper function is now unused but left in place in case it comes back later for order timing.

## Files

- `app/page.tsx` — one file

## Install

1. Extract this zip.
2. Overwrite `app/page.tsx` in your local repo.
3. Commit: `Fix cart Place Order button visibility + honest distance labels`
4. Push origin.

## What to test

**Cart:**
1. Add something to cart from a dish. Tap Cart nav.
2. Should see the "Place order · $X" button at the bottom, unobstructed.
3. Tapping the back arrow returns to Discover as before.

**Distance display:**
1. Discover feed — dish rows show "~1.2 mi" (no time).
2. Tap a dish — meal detail shows "~1.2 mi away" chip.
3. Tap "Show directions" — real driving distance and time appear in a pill inside the map area (e.g. "8 min · 1.7 mi by car").
4. The two numbers won't match anymore, and now that's honest — the ~1.2 is straight-line, the 8 min/1.7 mi is real driving.
