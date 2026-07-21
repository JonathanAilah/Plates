# Plates — Ratings & reviews

Buyers rate their dishes after pickup. Stars aggregate on dish cards. Reviews show on the meal detail page.

## What changed

**New: rating modal on app open.**
When you sign in (or refresh) and have completed orders (status = picked_up) without a rating, a bottom-sheet modal appears asking "How was your order?". Big 5-star tap targets, optional comment, submit or dismiss ("Later"). Dismissing keeps it out of the way for the rest of the session; it comes back on your next app open.

**Meal detail page shows reviews.**
Below the pickup info, a Reviews section with the aggregate rating chip and a list of reviews (name, avatar, stars, timestamp, comment). Empty state if no reviews yet.

**Dish cards show rating chips.**
- List row: `⭐ 4.6 (12)` or `⭐ New` if no reviews
- Hero "cook of the day" card: `Cook Name · ⭐ 4.6 · 0.8 mi`

**Server-side protections.**
- One review per order (enforced by UNIQUE constraint + duplicate check)
- Only the buyer can review their own order
- Only orders in `picked_up` status can be reviewed
- Rating must be an integer 1-5, comment capped at 500 chars

## Files

- `lib/db.ts` — new `dish_reviews` table, aggregate rating in getDishes/getDish, review helpers
- `app/api/reviews/route.ts` — NEW, review endpoints
- `app/page.tsx` — rating modal, meal detail reviews section, rating chips, dish/review interfaces

## How to install

1. Extract this zip.
2. Copy files into your local Plates repo:
   - `app/api/reviews/` folder is NEW — contains `route.ts`
   - `lib/db.ts` — overwrite
   - `app/page.tsx` — overwrite
3. GitHub Desktop should show 3 changed files (1 new folder).
4. Commit: `Add dish ratings and reviews`
5. Push origin — Vercel auto-deploys

The new `dish_reviews` table is created automatically on the next app load via the migration in `initializeDatabase()`. No manual SQL required.

## What to test

**As a buyer** (needs a picked_up order — either create one and cycle it all the way through, or grab an existing one you already completed):

1. Sign in / refresh the app.
2. If you have any picked_up orders without a review, the rating modal appears from the bottom of the screen.
3. Tap 5 stars, add "This was amazing!", submit.
4. Toast: "Thanks for rating!". Modal closes.
5. Go to Discover → tap that dish → scroll down → see your review at the top of the Reviews section.
6. Check the dish list row: the ★ chip now shows `5.0 (1)` instead of `New`.

**Try to break it:**
1. Refresh — the modal should NOT appear again for that dish (you already rated).
2. In Neon SQL, manually try to insert a duplicate: `INSERT INTO dish_reviews ...` — the UNIQUE constraint blocks it.

## Design decisions I made

- **Rating is required, comment optional** — matches your pick.
- **Modal appears once per session per order** — dismissing marks it "seen for now"; on next app open it comes back if still unrated. Prevents nagging but also prevents forgetting.
- **Ratings show as decimal to 1 place** — "4.6 (12)" rather than "4 stars".
- **"New" chip for un-rated dishes** — softer than showing "0 stars", encourages first-buyer risk.

## Not built

- Editing/deleting reviews after submission (deliberate — makes reviews more honest)
- Cook responses to reviews
- Filtering reviews by rating (5-star only, etc.)
- Photo uploads on reviews
- Review reports / moderation for admins (they can still delete dishes, which cascade-deletes reviews)
