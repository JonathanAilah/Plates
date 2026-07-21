# Plates — Community feed goes proximity-based

The feed now shows only posts from cooks within your chosen radius. Distance-first, follows-less. If the food looks good, you can actually go get it.

## What changed

**Posts snapshot the poster's location at creation.**
New `latitude` + `longitude` columns on the `posts` table. When you post, we grab your profile lat/lng and pin it to the post. That location is the post's location for its lifetime (24h).

**Viewer uses their current location, not their profile home.**
When you tap the Feed tab, the app asks for your current GPS location (fresh each session). If you're at a coffee shop 3 miles from home, the feed reflects where you actually are right now.

**Radius slider: 0.5 mi to 50 mi, default 5 mi.**
- Compact pill above the composer: "Within 5 mi" · "12 nearby"
- Tap the pill → bottom sheet with a slider + quick presets (Walk / Bike / Nearby / Cross-town / Metro)
- Big terracotta number shows the current setting live as you drag

**Each post card shows the distance.**
Compact chip in the post header: `3h ago · 21h left · 📍 0.8 mi`
- Under 0.1 mi = "here"
- Under 1 mi = shown in feet ("500 ft")
- Otherwise = "X.X mi"

**Fallback: no location = global feed.**
If the user denies the location prompt or their browser doesn't support geolocation, the feed shows all posts (no radius filter), with a small "Showing all posts globally" caption next to the disabled pill. Tapping the pill re-tries the location prompt.

**Empty state adapts.**
If you're within a radius and nothing matches: "No posts within 5 mi. Try expanding your radius." with an "Expand radius" button that opens the slider.

## Backend details

- SQL uses the **Haversine formula** inline — no PostGIS extension needed, works on stock Neon.
- Distance is calculated as a column so the frontend can display it (and it comes from the DB, not recomputed on client).
- Server clamps radius to 0.1–500 mi to prevent absurd queries.
- Posts with `NULL` location (created before this feature, or by users without a location) are excluded from proximity queries but included in global feed.

## Files

- `lib/db.ts` — new lat/lng columns on posts, updated `createPost` to snapshot location, updated `getFeed` with proximity params + Haversine
- `app/api/posts/route.ts` — feed endpoint accepts `lat`, `lng`, `radiusMi` query params
- `app/page.tsx` — proximity pill, radius slider bottom sheet, distance chips on cards, location prompt on Feed tab open

## Install

1. Extract this zip.
2. Copy files into your local repo, overwriting.
3. Commit: `Feed by proximity - posts filtered by viewer's current location`
4. Push origin.

Migrations run automatically on next app load.

## What to test

**As a signed-in user with location enabled:**
1. Sign in on a real phone (browser must have GPS access).
2. Discover → tap Feed tab.
3. Browser asks for location. Allow.
4. Pill at top shows "Within 5 mi". If any posts exist within 5mi of you, they show. Otherwise empty state.
5. Tap the pill → slider opens. Drag to 25 mi. More posts should appear.
6. Try the "Walk (0.5)" preset — probably only sees very close posts.
7. Post something. Reload feed — your post should show "here" or similar distance.

**Denied location:**
1. On a different browser or with location denied, open Feed.
2. Pill shows "Enable location". Feed shows all posts globally.
3. Tap "Enable location" — retries the prompt.

**Old posts** (created before this feature):
1. They have NULL location, so proximity-filtered feed won't show them.
2. Global fallback (no location) WILL show them.

## Design decisions

- **Current location, not home**: matches Uber Eats / DoorDash mental model — "food near me now"
- **Slider not chips**: gives full control across 0.5 → 50 mi range
- **Distance as a chip in the post header, not the body**: doesn't disrupt reading, but is scannable
- **Post location = poster's profile at time of post**: cooks can't spoof their location by editing their profile after posting; keeps the feed honest
- **Global fallback for no-location**: better to show something than nothing; users can enable location whenever

## Not built

- Post-specific locations (letting cooks say "I'm at Fruitvale Park today"). Would need a location picker UI at post time. Skipped for scope.
- Notifying you when someone posts nearby ("New post 0.3 mi away!"). Requires push notifications (future feature).
- Adjusting the radius pill visually based on radius (bigger dot = bigger radius, or a mini-map). Nice-to-have polish.
