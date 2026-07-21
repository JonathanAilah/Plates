# Plates — Fix: signed-in crash (React error #310)

## What was broken

After a user signed in via Clerk, the app crashed with `Application error: a client-side exception has occurred`. The browser console showed **React error #310** — "Rendered fewer hooks than expected."

## Why

React's rules: the SAME hooks must be called in the SAME order on every render. I violated that rule in my search-filters code — two `React.useMemo` calls were AFTER the `if (!user) return ...` early-return block.

**Anonymous render**: hits `if (!user) return anon-view`. React sees N hooks called.
**Signed-in render**: skips the early return, hits the `useMemo` calls below. React sees N+2 hooks. Crash.

## Fix

Moved both `React.useMemo` calls (`availableDietaryTags`, `filteredDishes`) and their derived values (`activeFilterCount`, `isFiltering`) to run BEFORE any early return. Now every render calls the same hooks in the same order.

Also null-guarded `user?.latitude` / `user?.longitude` inside the filter logic so it doesn't crash when user is null during initial render.

## Files

- `app/page.tsx` — one file, hook order fix

## Install

1. Extract this zip.
2. Overwrite `app/page.tsx` in your local Plates repo.
3. Commit: `Fix React error #310 - move useMemo hooks before early returns`
4. Push origin — Vercel auto-deploys.

## Test after deploy

1. Open incognito window → live site → anonymous view loads.
2. Click Sign in → complete Clerk flow.
3. **App should NOT crash.** You should land on the signed-in view with your dishes.

If you STILL see a crash, open DevTools console again and paste the new error — it'd be a different bug.
