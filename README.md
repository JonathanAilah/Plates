# Plates — Map pins v2

Fixes two things you noticed:
1. Only one pin on the map (should be 8)
2. Pins didn't shrink when zooming out

## What changed

**Pin sizing scales with zoom.**
At street-level zoom (15+), pins are 64px with a visible price tail.
At neighborhood zoom (~11-13), they shrink to ~40-55px, price tail hides.
At city zoom (~9-10), they're 25-35px, tiny dot with a food photo.
At regional zoom (8 and below), 20px — small circles you can pan around without visual clutter.

Icons are cached per-pin so zooming is smooth (no image reload).

**Seed dishes now have real locations.**
The old seed created ONE fake seller ('Neighborhood Kitchen') with no lat/lng — that's why only your own test dish had a pin.

The new seed creates 8 SEPARATE cooks, each with:
- Their own user account (Marisol, Rosa, Kemi, Lucia, Anh, Yerlan, Priya, Joe)
- Their own kitchen name
- A slightly offset lat/lng around Oakland's Fruitvale neighborhood
- Their one dish tied to them

Each dish now has a real seller location, so all 8 show up as distinct pins.

**The new seed script also cleans up the old single-seller seed data.**
When you re-run it, it deletes the old 'Neighborhood Kitchen' user (which also removes their location-less dishes) before creating the 8 new cooks. No manual DB cleanup needed.

## Files

- `components/MapView.tsx` — new pin sizing + zoom listener + icon caching
- `scripts/seed-mockup-dishes.ts` — creates 8 cooks with locations, cleans up old seed

Both are replacements. No new files, no new dependencies.

## Install

1. Extract this zip
2. Copy each file into your local Plates repo at the matching path
3. Both overwrite existing files
4. GitHub Desktop should show 2 changed files
5. Commit: `Zoom-responsive map pins + spread seed cooks across Bay Area`
6. Push origin

Vercel auto-deploys.

## Re-run the seed to swap the mockup dishes

The push above deploys the MapView fix but doesn't touch your database. You still have the old single-seller seed data in there. To fix the "one pin" problem, you need to re-run the seed locally:

```
npm run seed
```

You should see:
```
Seeding 8 mockup cooks + their dishes across the Bay Area...
Removing old single-seller seed data...
  removed.

Cook: Marisol Vega
  creating dish: Marisol Handmade Pupusas
    image generated (~180KB)
    dish inserted
[...continues for 8 cooks...]
Done. Created 8, backfilled 0, skipped 0, image failures 0.
```

Costs ~$0.32 on OpenAI credit again (regenerates the images since the old dishes get deleted).

After the seed runs, hard refresh your live site. Discover → Map tab. You should see 8 pins spread across Oakland's Fruitvale neighborhood. Try zooming in and out — pins should scale smoothly.

## Alternative if you don't want to spend another $0.32

If you'd rather NOT regenerate all 8 images, you can manually update the OLD dishes with lat/lngs instead of re-seeding. Open Neon SQL Editor and paste:

```sql
UPDATE users
SET latitude = 37.7757, longitude = -122.2251
WHERE email = 'seed-mockup@plates.local';
```

This gives ALL 8 dishes the same location (they all stack on one pin, since they all share the same seller). Not ideal but zero cost. Skip the seed re-run entirely — just push and deploy the MapView fix.

## What NOT to do

Don't run BOTH the SQL update above and the seed script. The seed would delete the just-updated seller. Pick one path.
