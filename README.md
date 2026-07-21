# Plates — Maps v2 update

## What changed

**In-app directions.** The "Show directions" button now draws the route from your location to the seller directly on the pickup map, and shows the driving distance + duration in a green banner. No more opening a new browser tab.

**Photo pins on the Discover map.** Each cook pin now shows a circular photo of the dish (with a terracotta ring and price badge). Dishes without a photo fall back to their emoji on the striped placeholder pattern.

## Files

Only 2 files change:

- `components/MapView.tsx` **REPLACE** — new photo-pin rendering + directions overlay
- `app/page.tsx` **REPLACE** — new directions toggle, hooks up trip info banner

## How to install

1. Extract this zip.
2. Copy each file into your local `Plates` repo at the matching path (both are replacements — no new folders).
3. GitHub Desktop should show 2 changed files.
4. Commit: `In-app directions + dish photo pins on map`
5. Push origin — Vercel auto-deploys.

## What to test after deploy

- **Discover → Map tab**: pins now show the dish photo (or emoji) in a circular frame with the price beneath. Tap a pin → opens the meal.
- **Meal detail → Show directions**: the route draws on the map in terracotta, and a green banner appears showing "X min · Y mi by car". Tap again to hide.

## Notes

- Photo pins convert your dish photos to canvas data URIs so they can be embedded in the map marker. If a photo fails to load, the pin falls back to the emoji automatically.
- Directions currently show DRIVING mode. If you want walking/biking added as options, tell me.
