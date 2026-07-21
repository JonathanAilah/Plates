# Plates — Cook profile update

Adds a full "Kitchen profile" section to the cook side of the app, matching the design mockup's cook onboarding fields.

## What changed

**Seller Dashboard**
- New "Kitchen profile" card at the top with a completeness progress bar
- Tap it to open the full profile editor

**Cook profile screen (new)**
- Legal name + display kitchen name
- Cottage-food law attestation checkbox
- Food handler permit yes/no + optional number
- Kitchen environment flags (pets, smokers, nut-free, gluten-free)
- Typical cooking hours
- Pickup spot description

**Meal Detail (buyer side)**
- Seller card now shows kitchen environment flags as tags
- Cooking hours appear under the seller name
- Pickup description shows in a subtle card below

Everything is opt-in — nothing is gated. Cooks can post dishes without touching this. Buyers see whatever's filled in.

## Files (3 replacements, no new files)

- `lib/db.ts` — adds 8 new user columns + `updateCookProfile` function
- `app/api/users/route.ts` — adds `updateCookProfile` action
- `app/page.tsx` — adds cook-profile screen, updates seller dashboard and meal detail

## How to install

1. Extract this zip.
2. Copy each file into your local Plates repo at the matching path — all three overwrite existing files.
3. GitHub Desktop should show 3 changed files.
4. Commit: `Add kitchen profile: legal, permits, environment flags, hours, pickup details`
5. Push origin — Vercel auto-deploys.

## What to test after deploy

1. Toggle Seller mode ON if it isn't already.
2. Go to Cook tab (bottom nav).
3. Tap the new "Complete your kitchen profile" card at the top.
4. Fill in the fields, tap Save profile.
5. Come back to Cook — card should now say "Kitchen profile complete" in green.
6. Add a dish, then view it in Discover, open it. You should see your cooking hours, environment flag tags, and pickup description on the meal detail.
