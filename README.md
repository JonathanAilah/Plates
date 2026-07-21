# Plates — Cook-controlled pickup bounds + kitchen environment on meal card

Two features stacked.

## Feature 1: Cook sets pickup time bounds

Each cook can now define their own minimum and maximum pickup time. Buyers can only choose within that window.

**In the Kitchen profile**, a new "Pickup time window" section appears with two sliders:
- **Minimum**: 5 min to 120 min in 5-min steps
- **Maximum**: 15 min to 240 min (4 hours) in 5-min steps

The sliders auto-adjust each other so max is always > min. Default is 15 min minimum / 120 min maximum (matches the old hard-coded values).

**In the buyer's Cart**, the pickup time slider now:
- **min = MAX of all cooks' minimums in the cart**
- **max = MIN of all cooks' maximums in the cart**
- Slider steps changed from 15 to 5 min (finer control now that cooks may have narrower ranges)
- Below the slider, shows the applicable range as text:
  - Single cook: `"Marisol Vega accepts pickups from 25 min to 90 min"`
  - Multi-cook: `"Range narrowed to fit all cooks in your cart"`

**Edge cases handled:**
- If one cook needs 40 min minimum and another has a 30 min maximum, the range collapses to nothing — the slider gets disabled and shows the invalid range
- If the buyer's chosen duration is outside a new bound (e.g. they had 30 min selected but then added a cook who needs 45 min), the effect clamps it to the new valid range
- Cooks who haven't set bounds fall back to defaults (15..120)

## Feature 2: Kitchen environment on the meal card

The "Home kitchen / Food truck / Community kitchen" etc that cooks set last session is now visible to buyers.

**On the meal detail page**, shown as a green chip next to the kitchen flags (e.g. "Home kitchen", "Nut-free kitchen"). Distinct color so it stands out from the dietary flags.

**On dish list rows on Discover**, a compact tan chip shows the environment (e.g. "Food truck") alongside the distance and rating chips. If the cook hasn't set an environment, no chip appears.

## Schema

Two new columns on `users`:
- `pickup_min_minutes INTEGER` — cook's minimum pickup duration (null = default 15)
- `pickup_max_minutes INTEGER` — cook's maximum (null = default 120)

Existing `kitchen_environment` column is now also SELECTed in `getDishes` (was set but not fetched).

## Files

- `lib/db.ts` — new columns + updateCookProfile signature + getDishes/getCart include the bounds
- `app/api/users/route.ts` — passes pickupMinMinutes and pickupMaxMinutes through
- `app/page.tsx` — cook's dual sliders, cart's bounded slider, kitchen env chips on meal detail + dish rows

## Install

1. Extract zip.
2. Overwrite the three files.
3. Commit: `Cook-defined pickup bounds + kitchen env on meal cards`
4. Push. Migrations run on next load.

## Test

**As cook:**
1. Cook → Kitchen profile → scroll to "Pickup time window".
2. Set min to 25 min, max to 60 min. Save.
3. Sign out.

**As buyer:**
4. Sign in as buyer. Add one of that cook's dishes to cart.
5. Open Cart. Pickup slider should now be locked between 25 and 60 min.
6. Under the slider: "Cook Name accepts pickups from 25 min to 1h".
7. On Discover, that cook's dish row shows the "Home kitchen" (or whatever they set) chip next to distance/rating.
8. Tap into the dish → meal detail shows the green "Home kitchen" badge inside the seller card.

## Design decisions

- **Bounds are per-cook, not per-dish**: matches the reality that a home cook has one kitchen with one set of constraints. Simpler UI too.
- **Cart intersects bounds, not per-item**: real-world, if you order from two cooks, you pick ONE time that works for both. Simplest UX.
- **5-minute step in cart** (was 15): now that cooks can set 25 or 35 min minimums, 15-min steps were too coarse.
- **Kitchen environment shown in green (meal detail)**: distinct from dietary flags (surface color) so buyers can visually parse "where" vs "what allergens".
