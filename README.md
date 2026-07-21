# Plates — Pickup code confirmation

Closes the loop on order tracking. Orders can no longer be marked "picked up" without the buyer showing the cook their 4-digit code.

## What changed

**Kitchen queue (cook side)**
- When an order is Ready, the "Mark picked up" button is replaced with "Enter pickup code"
- Tapping opens a 4-digit entry (auto-advances between boxes, backspace clears previous, submits when all 4 filled)
- Wrong code: boxes shake red, clear, refocus. No lockout, unlimited retries.
- Right code: order jumps to "picked up", success toast

**Order detail (buyer side)**
- Already shows the code in a big green display when order is Ready — no change needed

**API changes**
- New `confirmPickup` action on `/api/orders` requires the code
- `updateStatus` no longer accepts `picked_up` directly — must go through code verification
- Server validates: seller owns the order, order is in Ready status, code matches

## Files

- `app/api/orders/route.ts` — new confirmPickup action, blocks direct picked_up transition
- `app/page.tsx` — pickup entry UI + handler in Kitchen queue
- `app/globals.css` — adds plshake keyframe for wrong-code animation

## How to install

1. Extract this zip
2. Copy each file into your local Plates repo — all three overwrite existing files
3. GitHub Desktop should show 3 changed files
4. Commit: `Pickup code verification at handoff`
5. Push origin — Vercel auto-deploys

## What to test

Two windows: one as buyer, one as cook.

**Buyer:**
1. Place an order
2. Open its detail screen — you'll see the code in a big green display once cook marks it Ready

**Cook (other window):**
1. Kitchen queue → your order shows "Ready for pickup"
2. Tap **Enter pickup code**
3. Try a wrong code first — boxes shake red, clear, ready for retry
4. Type the correct code (that the buyer is showing you)
5. Order jumps to Picked up. Success toast.

## Design decisions I made for you

- Simple 4-digit entry, not a keypad — mobile keyboards handle numeric entry well already
- No lockout on wrong attempts — real-world typos and mis-reads are much more common than abuse, and locking out a legitimate cook mid-handoff would be a way worse UX
- Code stays hidden from cook until buyer shows it — this is the security value of the whole flow
- Server-side enforced — client can't just call `updateStatus` to skip verification
