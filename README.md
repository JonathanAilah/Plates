# Plates — In-app messaging

Order-scoped chat between buyer and cook. Threads open when an order is placed and close after pickup or cancellation.

## What changed

**Chat screen (new)**
- Header shows the other party (cook's kitchen name or buyer name) and current order status
- Message bubbles: yours in terracotta on the right, theirs in cream on the left
- Timestamps auto-appear when there's a 5+ minute gap between messages
- Empty state gently prompts a "hi" or a quick reply
- Auto-scrolls to newest message when opened or when a new one arrives
- 5-second polling for new messages while the chat is open
- Textarea grows for long messages; Enter sends, Shift+Enter for new line
- Once the order is picked up or cancelled, the composer is replaced with a "messages are closed" notice

**Quick-reply templates**
- Horizontal row above the composer: "On my way", "Running late", "I'm here", "Thanks!"
- Tap sends immediately, no typing needed

**Message buttons**
- **Order detail** (buyer view): message icon next to the cook's photo in the "Pickup from" card
- **Kitchen queue** (cook view): message icon at the end of each active order's action row

**Unread indicators**
- Small red badge with count on any message button
- Total unread count shown next to "Your orders" on Profile
- Total unread count shown on the Kitchen Queue card in Seller Dashboard
- Individual order rows in Your Orders show unread pill

**Security**
- API verifies the user is a participant (buyer or seller) on the order before serving/writing messages
- Sending is blocked on closed orders (picked_up/cancelled) server-side

## Files

- `lib/db.ts` **REPLACE** — new `messages` table + 5 helper functions (including auth check)
- `app/api/messages/route.ts` **NEW** — REST endpoints for list/send/markRead/unreadCounts
- `app/page.tsx` **REPLACE** — chat screen, buttons, badges, polling

## How to install

1. Extract this zip.
2. Copy each file into your local Plates repo:
   - `app/api/messages/` folder is NEW (contains `route.ts`)
   - The other two overwrite existing files
3. GitHub Desktop should show 3 changed files (one new).
4. Commit: `In-app messaging between buyer and cook (order-scoped)`
5. Push origin — Vercel auto-deploys.

## What to test after deploy

You'll want two browser windows to see both sides at once (one buyer, one cook).

**As a buyer:**
1. Place an order.
2. Go to Profile → Your orders → tap the order → in the "Pickup from" card, tap the terracotta message icon.
3. Try a quick-reply ("On my way"). Try typing a custom message and pressing Enter.

**As the cook (other window):**
1. Cook tab → Kitchen queue.
2. Your incoming order will have a message icon next to the action buttons.
3. Tap it — you'll see the buyer's message. Try replying.
4. Meanwhile watch the profile screen in the buyer window — the unread badge should tick up within 5 seconds.

**After pickup:**
1. Mark the order picked up.
2. Try to reopen the chat — you can still see the history, but the composer is replaced with "messages are closed".

## Known limitations

- No push notifications outside the app (same as order tracking — needs OneSignal/FCM later).
- Both parties must have their tab open on the app to see live updates. If a cook has the tab closed, they won't know a buyer messaged until they reopen it.
- No typing indicators, read receipts (data is captured server-side, just not shown).
- No image attachments (scope was text + templates only).
